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
        return await formio.cache.loadForm(req);
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
      try {
        const attachment = {};
        const project = await formio.cache.loadPrimaryProject(req);
        if (!project) {
          throw new Error('Project not found');
        }
        const form = await formio.cache.loadCurrentForm(req);
        const submission = _.get(res.resource, 'item', req.body);
        const downloadPDF = require('../../util/downloadPDF')(formioServer);

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
    }
  };

  // Replace SSO tokens.
  const replaceSSOTokens = async () => {
    if (mail.to.indexOf(',') !== -1) {
      return mail;
    }

    // Find the ssoToken.
    const ssoTokens = util.ssoTokens(mail.html);
    if (!ssoTokens || !ssoTokens.length) {
      return mail;
    }

    const query = await formio.hook.alter('formQuery', {
      deleted: {$eq: null}
    }, req);

    const formObjs = {};

    await async.eachSeries(ssoTokens, async (ssoToken) => {
      const inlineResource = ((!ssoToken.resources || !ssoToken.resources.length) &&
        res.resource &&
        res.resource.item);
      if (inlineResource) {
        query._id = res.resource.item.form;
      }
      else {
        query.name = {'$in': ssoToken.resources};
      }

      try {
        const result = await formio.resources.form.model.find(query).lean().exec();
        if (!result || !result.length) {
          ssoToken.submission = null;
          return;
        }

        const forms = [];
        result.forEach(function(form) {
          formObjs[form._id.toString()] = form;
          forms.push(form._id);
        });

        if (inlineResource) {
          ssoToken.submission = res.resource.item;
          return;
        }

        const submissionQuery = {
          project: formio.util.idToBson(req.projectId),
          form: {'$in': forms},
          deleted: {$eq: null}
        };

        // Set the username field to the email address this is getting sent to.
        submissionQuery[ssoToken.field] = formio.mongoFeatures.collation
          ? mail.to
          : {$regex: new RegExp(`^${formio.util.escapeRegExp(mail.to)}$`, 'i')};

        let subQuery = formio.resources.submission.model.findOne(submissionQuery);
        subQuery = formio.mongoFeatures.collation
          ? subQuery.collation({locale: 'en', strength: 2})
          : subQuery;
        // Find the submission.
        const submission = await subQuery.lean().select('_id, form').exec();
        ssoToken.submission = submission || null;
      }
      catch (err) {
        ssoToken.submission = null;
      }
    });
    await async.eachSeries(ssoTokens, async (ssoToken) => {
      if (!ssoToken.submission) {
        return;
      }
        const session = await formio.mongoose.models.session.create({
          project: formObjs[ssoToken.submission.form.toString()].project,
          form: ssoToken.submission.form,
          submission: ssoToken.submission._id,
          source: 'email',
        });

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
    });

    // Replace the string token with the one generated here.
    let index = 0;
    mail.html = mail.html.replace(util.tokenRegex, () => ssoTokens[index++].token || 'INVALID_TOKEN');

    return mail;
  };

  checkPlan()
    .then(attachFiles)
    .then(attachPDF)
    .then(replaceSSOTokens)
    .then(mail => cb(null, mail))
    .catch(err => cb(err));
};
