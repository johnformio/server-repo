'use strict';

const jwt = require('jsonwebtoken');
const util = require('../../util/util');
const async = require('async');
const _ = require('lodash');

module.exports = app => (mail, req, res, params, setActionItemMessage, cb) => {
  const formioServer = app.formio;
  const formio = formioServer.formio;

  // Check the Project plan.
  const checkPlan = async () => {
    // Allow emails for formio project.
    if (req.currentProject && req.currentProject.name === 'formio') {
      return;
    }
    if (typeof params.form === 'string') {
      await new Promise((resolve, reject) => {
        formio.cache.loadForm(req, null, params.form, (err, form) => {
          if (err) {
            return reject(err);
          }
          resolve(form);
        });
      });
    }
  };

  const attachFiles = () => {
    if (!_.get(params, 'settings.attachFiles')) {
      return;
    }

    const attachments = _.chain(params.componentsWithPath || params.components)
      .filter(component => component.type === 'file')
      .map(component => {
        let {compPath} = component;

        compPath = compPath || component.key;

        if (compPath && compPath.indexOf('.') !== -1) {
          compPath = compPath.split('.');
        }

        return util.getComponentDataByPath(compPath, params.data);
      })
      .flattenDeep()
      .compact()
      .map(file => ({
        filename: file.originalName,
        contentType: file.type,
        path: file.url,
      }))
      .value();

    mail.attachments = (mail.attachments || []).concat(attachments);
  };

  // Attach a PDF to the email.
  const attachPDF = async () => {
    // If they wish to attach a PDF.
    if (params.settings && params.settings.attachPDF) {
      const attachment = {};
      const project = await new Promise((resolve) => {
        formio.cache.loadPrimaryProject(req, (err, project) => resolve(project));
      });
      const form = await new Promise((resolve) => {
        formio.cache.loadCurrentForm(req, (err, form) => resolve(form));
      });
      const submission = _.get(res.resource, 'item', req.body);
      const downloadPDF = require('../../util/downloadPDF')(formioServer);

      try {
        const response = await downloadPDF(req, project, form, submission);
        if (response.status !== 200 || response.ok === false) {
          const nonFatalAttachmentError = await util.parseUnknownContentResponse(response);
          setActionItemMessage(
            'PDF Server returned an error while attempting to attach PDF submission',
            nonFatalAttachmentError,
            'error'
          );
          return;
        }
        const responseBuffer = await response.buffer();
        const base64 = responseBuffer.toString('base64');
        attachment.path = `data:application/pdf;base64,${base64}`;
      }
      catch (err) {
        // in case PDF throws an error rather than a bad response (e.g. the PDF server is not even configured) we want to
        // fail non-fatally
        setActionItemMessage(
          'Something went wrong while attempting to attach PDF submission',
          err.message || err,
          'error'
        );
        return;
      }

      // Get the file name settings.
      let fileName = params.settings.pdfName || '{{ form.name }}-{{ submission._id }}';

      // Only allow certain characters and keep malicious code from executing.
      fileName = fileName
        .replace(/{{/g, '----ob----')
        .replace(/}}/g, '----cb----')
        .replace(/[^0-9A-Za-z._-]/g, '')
        .replace(/----ob----/g, '{{')
        .replace(/----cb----/g, '}}');
      try {
        fileName = formio.util.FormioUtils.interpolate(fileName, {
          submission: submission,
          form: form
        }).replace('.', '');
      }
      catch (err) {
        fileName = `submission-${submission._id || submission.created}`;
      }

      attachment.filename = `${fileName}.pdf`;
      attachment.contentType = 'application/pdf';
      mail.attachments = (mail.attachments || []).concat([attachment]);
    }
  };

  // Replace SSO tokens.
  const replaceSSOTokens = () => new Promise((resolve) => {
    if (mail.to.indexOf(',') !== -1) {
      return resolve(mail);
    }

    // Find the ssoToken.
    const ssoTokens = util.ssoTokens(mail.html);
    if (!ssoTokens || !ssoTokens.length) {
      return resolve(mail);
    }

    const query = formio.hook.alter('formQuery', {
      deleted: {$eq: null}
    }, req);

    const formObjs = {};
    async.eachSeries(ssoTokens, (ssoToken, nextToken) => {
      const inlineResource = ((!ssoToken.resources || !ssoToken.resources.length) &&
        res.resource &&
        res.resource.item);
      if (inlineResource) {
        query._id = res.resource.item.form;
      }
      else {
        query.name = {'$in': ssoToken.resources};
      }
      formio.resources.form.model.find(query).lean().exec((err, result) => {
        if (err || !result || !result.length) {
          ssoToken.submission = null;
          return nextToken();
        }

        const forms = [];
        result.forEach(function(form) {
          formObjs[form._id.toString()] = form;
          forms.push(form._id);
        });

        if (inlineResource) {
          ssoToken.submission = res.resource.item;
          return nextToken();
        }

        const query = {
          project: formio.util.idToBson(req.projectId),
          form: {'$in': forms},
          deleted: {$eq: null}
        };

        // Set the username field to the email address this is getting sent to.
        query[ssoToken.field] = formio.mongoFeatures.collation ? mail.to : {$regex: new RegExp(`^${formio.util.escapeRegExp(mail.to)}$`, 'i')};

        let subQuery = formio.resources.submission.model.findOne(query);
        subQuery = formio.mongoFeatures.collation ? subQuery.collation({locale: 'en', strength: 2}) : subQuery;

        // Find the submission.
        subQuery.lean().select('_id, form').exec(function(err, submission) {
          ssoToken.submission = !submission ? null : submission;
          nextToken();
        });
      });
    }, () => {
      async.eachSeries(ssoTokens, (ssoToken, nextToken) => {
        if (!ssoToken.submission) {
          return nextToken();
        }
        formio.mongoose.models.session.create({
          project: formObjs[ssoToken.submission.form.toString()].project,
          form: ssoToken.submission.form,
          submission: ssoToken.submission._id,
          source: 'email',
        })
          .catch(nextToken)
          .then((session) => {
            ssoToken.token = formio.hook.alter('token', {
              user: {
                _id: ssoToken.submission._id.toString()
              },
              form: {
                _id: ssoToken.submission.form.toString()
              }
            }, formObjs[ssoToken.submission.form.toString()], {session});
            delete ssoToken.token.exp;
            ssoToken.token = jwt.sign(ssoToken.token, formio.config.jwt.secret, {
              expiresIn: ssoToken.expireTime * 60
            });
            nextToken();
          });
      }, () => {
        // Replace the string token with the one generated here.
        let index = 0;
        mail.html = mail.html.replace(util.tokenRegex, () => {
          return ssoTokens[index++].token || 'INVALID_TOKEN';
        });

        return resolve(mail);
      });
    });
  });

  checkPlan()
    .then(attachFiles)
    .then(attachPDF)
    .then(replaceSSOTokens)
    .then(mail => cb(null, mail))
    .catch(err => cb(err));
};
