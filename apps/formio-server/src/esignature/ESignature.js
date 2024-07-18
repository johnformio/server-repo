"use strict";
const _ = require('lodash');
const debug = {
  error: require('debug')('formio:esign:error'),
  esign: require('debug')('formio:esign'),
  validate: require('debug')('formio:esign:validate'),
};
const config = require('../../config');
const FormRevision = require('../revisions/FormRevision');
const crypto = require('crypto');
const fs = require('fs');
const {CompactSign, importPKCS8, compactVerify, importSPKI} = require('jose');

module.exports = class ESignature {
  constructor(app, req) {
    this.revisionModel = app.formio.formio.mongoose.models.submissionrevision;
    this.app = app;
    this.req = req;
    this.flattenedComponents = {};
    this.idToBson = app.formio.formio.util.idToBson;
    this.itemModel = app.formio.formio.mongoose.models.submission;
    this.esignatureModel = app.formio.formio.mongoose.models.esignature;
    // private key: format - 'pem', type - 'pkcs8'
    this.privateKey = fs.readFileSync('./src/esignature/private.key', 'utf8');
    // public key: format - 'pem', type - 'spki'
    this.publicKey = this.getPublicKey();
    this.formRevision = null;
    const submissionModel = req.submissionModel || null;
    if (submissionModel) {
      this.revisionModel = app.formio.formio.mongoose.model(
        `${submissionModel.modelName}_revisions`,
        app.formio.formio.schemas.submissionrevision,
        `${submissionModel.modelName}_revisions`
      );
      this.itemModel = submissionModel;
    }
  }

  allowESign() {
    // TODO - change license to false
    return !config.formio.hosted &&
      _.get(this.req, 'licenseTerms.options.sac', true) &&
      _.get(this.req.currentForm, 'submissionRevisions');
  }

  haveESignSettings() {
    return !!_.get(this.formRevision, 'esign.signatures', []).length;
  }

  async setRevisionForm(submission, form) {
    let formRevision = {...form};
    if (
      !(!submission.hasOwnProperty('_fvid') ||
      (form.hasOwnProperty('revisions') && (form.revisions === 'current')) ||
      form._vid === submission._fvid)
    ) {
      // If the submission refers to a specific form revision, load it instead of the current form revision.
      const formRevisionModel = this.app.formio.formio.mongoose.models.formrevision;
      const result = await formRevisionModel.findOne({
        _rid: form._id,
        _vid: submission._fvid,
        deleted: {
          $eq: null,
        },
      });
      formRevision = {...formRevision, ...(_.pick(result.toObject(), FormRevision.defaultTrackedProperties))};
    }

    let revisionPromiseResolve;

    const revisionPromise = new Promise((res) => {
      revisionPromiseResolve = res;
    });

    this.app.formio.formio.cache.loadSubForms(formRevision, this.req, (err) => {
      if (err) {
        debug.esign(`Form Revision SubForms loading error: ${err}`);
      }
      this.flattenedComponents = this.app.formio.formio.util.flattenComponents(formRevision.components, true);
      return revisionPromiseResolve(formRevision);
    });

    this.formRevision = formRevision;
    return await revisionPromise;
  }

  md5(value) {
    const base64Value = Buffer.from(JSON.stringify(value)).toString('base64');
    return require('crypto').createHash('md5').update(base64Value).digest('hex');
  }

  async encryptData(data) {
    const formattedPrivateKey = await importPKCS8(this.privateKey, 'PS256');

    return await new CompactSign(new TextEncoder().encode(JSON.stringify(data)))
      .setProtectedHeader({alg: 'PS256'})
      .sign(formattedPrivateKey);
  }

  async decryptData(encrypedData) {
    const {payload} = await compactVerify(
      encrypedData,
      await importSPKI(this.publicKey, 'PS256')
    );

    return JSON.parse(new TextDecoder('utf-8').decode(payload));
  }

  getPublicKey() {
    const pubKeyObject = crypto.createPublicKey({
      key: this.privateKey,
      format: 'pem'
    });

    return pubKeyObject.export({
        format: 'pem',
        type: 'spki',
    });

  //   generateKeyPair(
  //     "rsa",
  //     {
  //       modulusLength: 2048,
  //       publicKeyEncoding: {
  //         type: 'spki',
  //         format: "pem",
  //       },
  //       privateKeyEncoding: {
  //         type: 'pkcs8',
  //         format: "pem",
  //       },
  //     },
  //     (err, publicKey, privateKey) => {
  //       // Handle errors and use the generated key pair.
  //       if (err) console.log("Error!", err);
  //       console.log(1111,{
  //         publicKey,
  //         privateKey,
  //       });
  //     console.log(555, pk)
  // })
  }

  async attachSubmissionRefs(components, submissionData) {
    const promises = [];
    const childRefs = [];

    this.app.formio.formio.util.eachValue(
      components,
      submissionData,
      ({component,
        data,
        path}) => {
          if (component) {
            const compPath =  this.app.formio.formio.util.valuePath(path, component.key);

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
                this.app.formio.formio.cache.loadSubmission(
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
                  }
                );
              }
            }
          }
      }, {});

      const currentPromises = await Promise.all(promises);
      return childRefs.length ? Promise.all(childRefs) : currentPromises;
  }

  async getESignatureData(compPath, valuePath, revisionItem, user) {
    const form = this.formRevision || {};
    revisionItem = this.fastCloneDeep(revisionItem);

    await this.attachSubmissionRefs(this.formRevision.components, revisionItem.data);

    return  {
      submission: revisionItem,
      form: this.md5({
        components: form.components,
        controller: form.controller,
      }),
      user: {
        _id: user._id,
        data: _.get(user, 'data.email'),
      },
      compPath,
      valuePath
    };
  }

  async createESignature(compPath, valuePath, revisionItem, user) {
    debug.esign(`Create esignature for ${revisionItem?._id}`);
    const esignatureData = await this.getESignatureData(compPath, valuePath, revisionItem, user);

    const esignature = {signature: await this.encryptData(esignatureData), _sid: revisionItem._rid};
    const result = await this.esignatureModel.create(esignature);
    return result.toObject();
  }

  async validateAndAttachESignatures(resultSubmission, submission, form, done) {
    debug.esign(`Validate and attach esignatures for ${submission._id}`);
    try {
      const submissionESignatureIds = _.get(submission, 'eSignatures', []);
      if (!submissionESignatureIds.length) {
        debug.esign('No esignatures found for submission');
        return done();
      }

      await this.setRevisionForm(submission, form);

      if (!this.haveESignSettings()) {
        debug.esign('No esign settings found');
        return done();
      }

      let submissionESignatures = await this.loadAndDecryptSignatures(submissionESignatureIds);
      submissionESignatures = await Promise.all(_.map(submissionESignatures, async (esign) => {
        const valid = await this.validateESignature(esign, submission);
        return valid === true
        ? {
            ...esign,
            valid
          }
        : {
          _id: esign._id,
          valid
        };
      }));

      resultSubmission.eSignatures = submissionESignatures;
      done();
    }
    catch (e) {
      debug.error(`Validate and attach esignature error: ${e}`);
      console.log(777, e);
      done(e);
    }
  }

  async validateOrCreateESignature(
    signatureSettings = {},
    valuePath,
    prevSignature,
    revisionItem,
    item,
    user
  ) {
    if (prevSignature) {
      const isPrevSignatureValid = await this.validateESignature(prevSignature, item);
      if (isPrevSignatureValid === true) {
        prevSignature.new = false;
        return prevSignature;
      }
    }
    const newSignature = await this.createESignature(signatureSettings.component, valuePath, revisionItem, user);
    newSignature.new = true;
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
      return 'No ESignature Data Found';
    }

    if (_.isString(esignature)) {
      esignature = await this.decryptData(esignature);
    }

    if (!_.isObject(esignature)) {
      debug.validate(`${signatureObj?._id} - validation failed: ESignature invalid format`);
      return 'ESignature invalid format';
    }
    const {esign = {}} = this.formRevision || {};
    const {signatures = [], submissionProps = ''} = esign;
    const esignatureSettings = _.find(signatures, sign => esignature.compPath === sign.component);

    if (!esignatureSettings) {
      debug.validate(`${signatureObj?._id} - validation failed: No ESignature settings found`);
      return 'No ESignature settings found';
    }
    const {component, excludedData = []} = esignatureSettings;
    const signatureCurrentData = await this.getESignatureData(component, null, _.cloneDeep(submission), {});
    // compare form
    const isFormDataEqual = _.isEqual(signatureCurrentData.form, esignature.form);

    if (!isFormDataEqual) {
      debug.validate(`${signatureObj?._id} - validation failed: Form changed`);
      return 'Form changed';
    }

    // compare submissions
    const {data: currentSubmData = {}, _id: currentSubmissionId, form: currentFormId, project: currentProjectId} = this.fastCloneDeep(signatureCurrentData.submission|| {});
    const {data: signatureSubmData = {}, form: signatureFormId, project: signatureProjectId, _rid: signatureSubmissionId} = this.fastCloneDeep(esignature.submission || {});

    if (!_.isEqual(currentProjectId.toString(), signatureProjectId.toString()) ||
      !_.isEqual(currentFormId.toString(), signatureFormId.toString()) ||
      !_.isEqual(currentSubmissionId.toString(), signatureSubmissionId.toString())
    ) {
      debug.validate(`${signatureObj?._id} - validation failed: Invalid project/form/submission ID`);
      return 'Invalid project/form/submission ID';
    }

    _.each(excludedData || [], valuePath => {
      const excludedValuePathsInSignSubmData = this.getComponentValuePaths(valuePath, signatureSubmData);
      _.each(excludedValuePathsInSignSubmData, (path) => {
        _.unset(currentSubmData, path);
        _.unset(signatureSubmData, path);
      });
    });

    if (!_.isEqual(currentSubmData, signatureSubmData)) {
      debug.validate(`${signatureObj?._id} - validation failed: Submission data changed`);
      return 'Submission data changed';
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
        return 'Value of custom properties changed';
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
                result.push(`${pathPart}[${i}]`);
              }
              return result;
            }
          }
          result.push(`${pathPart}[0]`);
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
                  paths.push(`${pathStart}${pathPart}[${i}]`);
                }
                return paths;
              }
            }
            return `${pathStart}${pathPart}[0]`;
          })
          .flatten()
          .value();
        }
      }

      return isFirstPart ? [`${pathPart}.`] : _.map(result, path => `${path}${pathPart}.`);
    }, []);
  }

  async checkSignatures(item, revisionItem, form, done) {
    debug.esign(`Check signatures for ${item?._id}`);
    try {
      await this.setRevisionForm(item, form);
      if (!this.haveESignSettings()) {
        return done();
      }

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
              this.req.user
            ));
          }
        });
      });

      if (signaturePromises.length) {
        const eSignatures = await Promise.all(signaturePromises);
        const eSignatureIds = _.map(eSignatures || [], (esign) => esign._id);
        item.eSignatures = revisionItem.eSignatures = eSignatureIds;
        await this.updateSubmission(item, revisionItem, {eSignatures: eSignatureIds});

        done(null, eSignatureIds);
      }
      else {
        done(null, []);
      }
    }
    catch (e) {
      debug.error(`Check Signatures error: ${e}`);
      console.log(555, e);
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
