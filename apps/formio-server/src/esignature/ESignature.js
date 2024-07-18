"use strict";
const _ = require('lodash');
const debug = {
  error: require('debug')('formio:esign:error'),
  esign: require('debug')('formio:esign'),
  validate: require('debug')('formio:esign:validate'),
};
const config = require('../../config');
const FormRevision = require('../revisions/FormRevision');
const keyServices = require('../kms');

module.exports = class ESignature {
  constructor(formioServer, req) {
    this.revisionModel = formioServer.formio.mongoose.models.submissionrevision;
    this.itemModel = formioServer.formio.mongoose.models.submission;
    this.esignatureModel = formioServer.formio.mongoose.models.esignature;
    this.formioServer = formioServer;
    this.req = req;

    const submissionModel = req.submissionModel || null;
    if (submissionModel) {
      this.revisionModel = formioServer.formio.mongoose.model(
        `${submissionModel.modelName}_revisions`,
        formioServer.formio.schemas.submissionrevision,
        `${submissionModel.modelName}_revisions`
      );
      this.itemModel = submissionModel;
    }

    this.idToBson = formioServer.formio.util.idToBson;
    this.flattenedComponents = {};
    this.formRevision = null;
  }

  allowESign(form) {
    return !config.formio.hosted &&
      _.get(this.req, 'licenseTerms.options.esign', false) &&
      !!_.get(form, 'submissionRevisions') &&
      form?.revisions === 'original';
  }

  initKms() {
    const kmsType = _.get(this.req, 'currentProject.settings.esign.kms');
    const CustomKms = _.get(keyServices, kmsType);

    if (kmsType && kmsType !== 'defaultKms' && CustomKms) {
      const kmsConfig = _.get(this.req, `currentProject.settings.kms.${kmsType}`, {});
      this.kms = new CustomKms(kmsConfig);
    }
    else {
      const privateKey = config.esignPrivateKey;
      if (!privateKey) {
        throw new Error('Unable to init eSignature kms. ESIGN_PRIVATE_KEY is not set.');
      }
      const DefaultKms = keyServices.defaultKms;
      this.kms = new DefaultKms({
        privateKey
      });
    }
  }

  haveESignSettings() {
    return !!_.get(this.formRevision, 'esign.signatures', []).length;
  }

  async setRevisionForm(formId, formRev) {
    let formPromiseResolve;
    let formPromiseReject;

    const formPromise = new Promise((res, rej) => {
      formPromiseResolve = res;
      formPromiseReject = rej;
    });

    this.formioServer.formio.cache.loadForm(this.req, null, formId, (err, form) => {
      if (err) {
        debug.error(`Unable to load form ${formId}`);
        formPromiseReject(err);
      }
      formPromiseResolve(form);
    }, true);

    let formRevision = await formPromise;

    if (_.isNumber(formRev) &&
      !((formRevision.hasOwnProperty('revisions') && (formRevision.revisions === 'current')) ||
      formRevision._vid === formRev)
    ) {
      // If the submission refers to a specific form revision, load it instead of the current form revision.
      const formRevisionModel = this.formioServer.formio.mongoose.models.formrevision;
      const result = await formRevisionModel.findOne({
        _rid: formId,
        _vid: formRev,
        deleted: {
          $eq: null,
        },
      });
      formRevision = {...formRevision, ...(_.pick(result ? result.toObject() : {}, FormRevision.defaultTrackedProperties))};
    }
    this.flattenedComponents = this.formioServer.formio.util.flattenComponents(formRevision.components, true);
    this.formRevision = formRevision;
  }

  async attachSubForms() {
    let revisionPromiseResolve;

    const revisionPromise = new Promise((res) => {
      revisionPromiseResolve = res;
    });

    this.formioServer.formio.cache.loadSubForms(this.formRevision, this.req, (err) => {
      if (err) {
        debug.esign(`Form Revision SubForms loading error: ${err}`);
      }
      return revisionPromiseResolve();
    });

    await revisionPromise;
  }

  async getCurrentSubmission(submissionId) {
    let submissionPromiseResolve;
    let submissionPromiseReject;

    const submissionPromise = new Promise((res, rej) => {
      submissionPromiseResolve = res;
      submissionPromiseReject = rej;
    });

    this.formioServer.formio.cache.loadSubmission(this.req, this.formRevision._id, submissionId, (err, subm) => {
      if (err) {
        debug.error(`Unable to load submission ${submissionId}`);
        submissionPromiseReject(err);
      }
      submissionPromiseResolve(subm);
    }, true);

    return await submissionPromise;
  }

  md5(value) {
    const base64Value = Buffer.from(JSON.stringify(value)).toString('base64');
    return require('crypto').createHash('md5').update(base64Value).digest('hex');
  }

  async encryptData(data) {
    return await this.kms.sign(data);
  }

  async decryptData(encrypedData) {
    return await this.kms.verify(encrypedData);
  }

  async attachSubmissionRefs(submissionData) {
    const promises = [];
    const childRefs = [];

    this.formioServer.formio.util.eachValue(
      this.formRevision.components,
      submissionData,
      ({component,
        data,
        path}) => {
          if (component) {
            const compPath =  this.formioServer.formio.util.valuePath(path, component.key);

            const isNestedForm = component.type === 'form' && component.form;
            const isSelectReference = component.type === 'select' && component.reference && component.data?.resource;

            if (isNestedForm || isSelectReference) {
              const formId = isNestedForm ? component.form : component.data?.resource;
              const subSubmissionId = _.get(data, `${compPath}._id`);

              if (subSubmissionId) {
                let subSubmissionPromiseResolve;
                const subSubmissionPromise = new Promise(res => {
                  subSubmissionPromiseResolve = res;
                });
                promises.push(subSubmissionPromise);
                // load submission for nested form
                this.formioServer.formio.cache.loadSubmission(
                  this.req,
                  formId,
                  subSubmissionId,
                  (err, subSubmission) => {
                    if (err) {
                      debug.esign(`Unable to load reference for submission ${subSubmissionId} of form ${formId}`);
                    }

                    if (subSubmission?.data) {
                      _.set(data, compPath, {_id: subSubmissionId, data: subSubmission.data});

                      if (isNestedForm && component.components) {
                        // recursively load all subforms data
                        childRefs.push(this.attachSubmissionRefs(component.components, subSubmission.data));
                      }
                      subSubmissionPromiseResolve();
                    }
                  },
                  // do not take result from cache as it can be mutated
                  true
                );
              }
            }
          }
      }, {});

      const currentPromises = await Promise.all(promises);
      return childRefs.length ? Promise.all(childRefs) : currentPromises;
  }

  async getESignatureData(compPath, valuePath, revisionItem) {
    const form = this.formRevision || {};
    const user = this.req.user;
    revisionItem = this.fastCloneDeep(revisionItem);

    await this.attachSubForms();
    await this.attachSubmissionRefs(revisionItem.data);

    return  {
      submission: revisionItem,
      form: this.md5({
        components: form.components,
        controller: form.controller,
      }),
      user: {
        _id: user?._id,
        data: user ? _.get(user, 'data.email') : 'anonymous',
      },
      compPath,
      valuePath
    };
  }

  async createESignature(compPath, valuePath, revisionItem) {
    debug.esign(`Create esignature for ${revisionItem?._id}`);
    const esignatureData = await this.getESignatureData(compPath, valuePath, revisionItem);

    const esignature = {signature: await this.encryptData(esignatureData), _sid: revisionItem._rid};
    const result = await this.esignatureModel.create(esignature);
    return result ? result.toObject() : null;
  }

  async attachESignatures(resultSubmission, done) {
    debug.esign(`Validate and attach esignatures for ${resultSubmission?._id}`);
    try {
      const submissionESignatureIds = _.get(resultSubmission, 'eSignatures', []);
      if (!submissionESignatureIds.length) {
        debug.esign('No esignatures found for submission');
        return done();
      }

      await this.setRevisionForm(resultSubmission.form, resultSubmission._fvid);

      if (!this.haveESignSettings()) {
        debug.esign('No esign settings found');
        return done();
      }
      this.initKms();

      let submission = null;
      const attachToSubmissionRevItem = !!resultSubmission._rid;
      if (attachToSubmissionRevItem) {
        submission = await this.revisionModel.findOne(
          {
            _id: resultSubmission._id,
            deleted: {$eq: null}
          }
        );
        submission._id = submission._rid;
      }
      else {
        // load clean submission form signature validation
        submission = await this.getCurrentSubmission(resultSubmission._id);
      }

      if (!submission) {
        debug.esign('No submission found.');
        return done();
      }

      let submissionESignatures = await this.loadAndDecryptSignatures(submissionESignatureIds);
      submissionESignatures = await Promise.all(_.map(submissionESignatures, async (esign) => {
        const valid = await this.validateESignature(esign, submission);
        return  this.normalizeESignatureObject({
          ...esign,
          valid
        });
      }));

      resultSubmission.eSignatures = submissionESignatures;
      done();
    }
    catch (e) {
      debug.error(`Validate and attach esignature error: ${e}`);
      done();
    }
  }

  normalizeESignatureObject(esign) {
    return _.omit(esign, ['deleted', 'signature.form', 'signature.submission.data']);
  }

  async validateOrCreateESignature(
    signatureSettings = {},
    valuePath,
    prevSignature,
    revisionItem,
    item,
  ) {
    if (prevSignature) {
      const isPrevSignatureValid = await this.validateESignature(prevSignature, item);
      if (isPrevSignatureValid === true) {
        return prevSignature;
      }
    }
    const newSignature = await this.createESignature(signatureSettings.component, valuePath, revisionItem);
    return newSignature;
  }

  fastCloneDeep(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  async validateESignature(signatureObj, submission) {
    debug.validate(`Validate esignature ${signatureObj?._id}`);
    let esignature = signatureObj?.signature;
    if (!esignature) {
      debug.validate(`${signatureObj?._id} - validation failed: No ESignature Data Found`);
      return 'No eSignature data has been found';
    }

    if (_.isString(esignature)) {
      esignature = await this.decryptData(esignature);
    }

    if (!_.isObject(esignature)) {
      debug.validate(`${signatureObj?._id} - validation failed: ESignature invalid format`);
      return 'ESignature has invalid format';
    }
    const {esign = {}} = this.formRevision || {};
    const {signatures = [], submissionProps = ''} = esign;
    const esignatureSettings = _.find(signatures, sign => esignature.compPath === sign.component);

    if (!esignatureSettings) {
      debug.validate(`${signatureObj?._id} - validation failed: No ESignature settings found`);
      return 'No ESignature settings have been found';
    }
    const {component, signedData = [], signAll} = esignatureSettings;
    const signatureCurrentData = await this.getESignatureData(component, null, _.cloneDeep(submission), {});
    // compare form
    const isFormDataEqual = _.isEqual(signatureCurrentData.form, esignature.form);

    if (!isFormDataEqual) {
      debug.validate(`${signatureObj?._id} - validation failed: Form changed`);
      return 'The form has changed';
    }

    // compare submissions
    const {data: currentSubmData = {}, _id: currentSubmissionId, form: currentFormId, project: currentProjectId} = this.fastCloneDeep(signatureCurrentData.submission|| {});
    const {data: signatureSubmData = {}, form: signatureFormId, project: signatureProjectId, _rid: signatureSubmissionId} = this.fastCloneDeep(esignature.submission || {});

    if (!_.isEqual(currentProjectId.toString(), signatureProjectId.toString()) ||
      !_.isEqual(currentFormId.toString(), signatureFormId.toString()) ||
      !_.isEqual(currentSubmissionId.toString(), signatureSubmissionId.toString())
    ) {
      debug.validate(`${signatureObj?._id} - validation failed: Invalid project/form/submission ID`);
      return 'Invalid project/form/submission ID is provided';
    }

    const isDataEqual = signAll
      ? _.isEqual(currentSubmData, signatureSubmData)
      : (_.every(signedData || [], valuePath => {
          const valuePathsInSubmData = this.getComponentValuePaths(valuePath, signatureSubmData);
          return _.every(valuePathsInSubmData, (path) => _.isEqual(_.get(currentSubmData, path), _.get(signatureSubmData, path)));
        }) &&  _.isEqual(_.get(currentSubmData, esignature.valuePath), _.get(signatureSubmData, esignature.valuePath)));

    if (!isDataEqual) {
      debug.validate(`${signatureObj?._id} - validation failed: Submission data changed`);
      return 'The submission data has changed';
    }

    if (submissionProps) {
      const customSignatureProps = {};
      const customCurrentProps = {};

      const customPropsArr = _.chain(submissionProps).split(',').map(v => _.trim(v)).value();
      _.each(customPropsArr || [], prop => {
        _.set(customSignatureProps, prop, _.get(signatureCurrentData.submission, prop));
        _.set(customCurrentProps, prop, _.get(esignature.submission, prop));
      });

      if (!_.isEqual(customCurrentProps, customSignatureProps)) {
        debug.validate(`${signatureObj?._id} - validation failed: Value of custom properties changed`);
        return 'The value of custom properties has changed';
      }
    }
    debug.validate(`Valid ESignature: ${signatureObj?._id}`);
    return true;
  }

  async loadAndDecryptSignatures(signatures) {
    debug.esign(`Load and descypt esignatures`);
    const result = await this.esignatureModel.find({
      _id: {
        $in: _.map(signatures || [], sign => _.isObject(sign) ? sign._id : sign)
      },
      deleted: {
        $eq: null,
      },
    });

    return Promise.all(_.map(result || [], async (esign) => {
      if (esign) {
        const esignObject = esign.toObject();
        esignObject.signature = await this.decryptData(esignObject.signature);
        return esignObject;
      }
      return esign;
    }));
  }

  shouldHaveESignature(data, valuePath) {
    const signatureValue = _.get(data, valuePath);
    return _.isObject(signatureValue) ? !_.isEmpty(signatureValue) : !!signatureValue;
  }

  getPrevSignature(prevSignatures, signatureCompPath, signatureValuePath) {
    return _.find(prevSignatures, sign => {
      const {compPath, valuePath} = sign.signature;
      return signatureCompPath === compPath && valuePath === signatureValuePath;
    });
  }

  getComponentValuePaths(compPath = '', submissionData) {
    if (!compPath) {
      return [];
    }

    const compPathParts = _.split(compPath, '.');
    const flattenedComps = this.flattenedComponents;
    const comp = flattenedComps[compPath];

    if (!comp || compPathParts.length < 2) {
      return [compPath];
    }

    const rowDataComponents = ['datagrid', 'editgrid', 'datatable', 'tagpad', 'dynamicWizard'];

    return _.reduce(compPathParts, (result, pathPart, ind) => {
      if (ind + 1 === compPathParts.length) {
        return _.map(result, path => `${path}${pathPart}`);
      }

      const isFirstPart = ind === 0;
      const parentCompPath = _.chain(compPathParts).slice(0, ind + 1).join('.').value();
      const parentComp = flattenedComps[parentCompPath];

      if (parentComp && _.includes(rowDataComponents, parentComp.type)) {
        if (isFirstPart) {
          const rowComponentValue = _.get(submissionData, pathPart);
          if (_.isArray(rowComponentValue)) {
            const valueLength = rowComponentValue.length;
            if (valueLength) {
              // eslint-disable-next-line max-depth
              for (let i = 0; i < valueLength; i++) {
                result.push(`${pathPart}[${i}].`);
              }
              return result;
            }
          }
          result.push(`${pathPart}[0].`);
          return result;
        }
        else {
          return _.chain(result)
          .map(pathStart => {
            const rowComponentValue = _.get(submissionData, `${pathStart}${pathPart}`);
            if (_.isArray(rowComponentValue)) {
              const valueLength = rowComponentValue.length;
              if (valueLength) {
                const paths = [];
                // eslint-disable-next-line max-depth
                for (let i = 0; i < valueLength; i++) {
                  paths.push(`${pathStart}${pathPart}[${i}].`);
                }
                return paths;
              }
            }
            return `${pathStart}${pathPart}[0].`;
          })
          .flatten()
          .value();
        }
      }

      return isFirstPart ? [`${pathPart}.`] : _.map(result, path => `${path}${pathPart}.`);
    }, []);
  }

  async checkSignatures(item, revisionItem, done) {
    debug.esign(`Check signatures for ${item?._id}`);

    if (!item || !revisionItem) {
      done();
    }

    try {
      await this.setRevisionForm(revisionItem.form, revisionItem._fvid);
      if (!this.haveESignSettings()) {
        return done();
      }
      this.initKms();
      let prevSignatures = this.req.prevESignatures;
      if (!_.isEmpty(prevSignatures)) {
        prevSignatures = await this.loadAndDecryptSignatures(prevSignatures);
      }

      const {signatures = []} = this.formRevision.esign || {};
      const signaturePromises = [];

      _.each(signatures, (signatureSettings) => {
        const {component} = signatureSettings;
        const signatureValuePaths = this.getComponentValuePaths(component, revisionItem.data);

        _.each(signatureValuePaths, (valuePath) => {
          if (this.shouldHaveESignature(revisionItem.data, valuePath)) {
            signaturePromises.push(this.validateOrCreateESignature(
              signatureSettings,
              valuePath,
              this.getPrevSignature(prevSignatures, component, valuePath),
              revisionItem,
              item,
            ));
          }
        });
      });

      const eSignatures = await Promise.all(signaturePromises);
      const eSignatureIds = _.map(eSignatures || [], (esign) => esign?._id);
      item.eSignatures = revisionItem.eSignatures = eSignatureIds;
      await this.updateSubmission(item, revisionItem, {eSignatures: eSignatureIds});

      done(null, eSignatureIds);
    }
    catch (e) {
      debug.error(`Check Signatures error: ${e}`);
      done(e);
    }
  }

  async updateSubmission(item, revisionItem, updates) {
    debug.esign('Update submission and submssion revisoons with new signatures and state');
    const submissionPromises = [];
    if (item) {
      submissionPromises.push(
        this.itemModel.updateOne(
          {
            _id: item._id
          },
          {
            $set: updates,
          }
        )
      );
    }

    if (revisionItem) {
      submissionPromises.push(
        this.revisionModel.updateOne(
          {
            _id: revisionItem._id
          },
          {
            $set: updates,
          }
        )
      );
    }

    return Promise.all(submissionPromises);
  }

  delete(submissionId, next) {
    this.esignatureModel.updateMany(
      {
        _sid: this.idToBson(submissionId),
        deleted: {
          $eq: null,
        },
      },
      {
        deleted: Date.now(),
        markModified: 'deleted',
      },
      (err) => {
        if (err) {
          return next(err);
        }
        next();
      }
    );
  }
};
