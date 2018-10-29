'use strict';

const jwt = require('jsonwebtoken');
const util = require('../../util/util');
const async = require('async');
const config = require('../../../config');
const FormioUtils = require('formiojs/utils').default;
const _ = require('lodash');

module.exports = app => (mail, req, res, params, cb) => {
  const formioServer = app.formio;

  // Check the Project plan.
  const checkPlan = () => new Promise((resolve, reject) => {
    // Restrict basic and independent plans.
    if (req && req.primaryProject) {
      if (formioServer.analytics.isLimitedEmailPlan(req.primaryProject)) {
        const transport = mail.msgTransport || 'default';
        if (transport !== 'default' && transport !== 'test') {
          return reject('Plan limited to default transport only.');
        }

        formioServer.analytics.incrementEmailCount(req.primaryProject, (err) => {
          if (err) {
            return reject(err);
          }

          mail.html += `
<table style="margin: 0px;padding: 20px;background-color:#002941;color:white;width:100%;">
  <tbody>
  <tr>
    <td align="center" style="font-size:24px;font-family:sans-serif;">
      <div style="padding:10px;">Sent using the <a href="https://form.io" style="color:white;">form.io</a> platform</div>
      <div style=""><img style="height:64px;" src="https://form.io/assets/images/formio-logo.png"></div>
    </td>
  </tr>
  </tbody>
</table>`;
          return resolve();
        });
      }
      else {
        return resolve();
      }
    }
    else {
      return resolve();
    }
  });

  const attachFiles = () => new Promise((resolve) => {
    if (params.settings && params.settings.attachFiles) {
      mail.attachments = (mail.attachments || []).concat(_(params.components)
        .filter((component) => component.type === 'file')
        .map((component) => params.data[component.key])
        .flatten()
        .compact()
        .filter((file) => file.url.startsWith('data:application/pdf;base64,'))
        .map((file) => ({
          filename: file.originalName,
          contentType: file.type,
          path: file.url,
        }))
        .value()
      );
    }

    resolve();
  });

  // Attach a PDF to the email.
  const attachPDF = () => new Promise((resolve) => {
    // If they wish to attach a PDF.
    if (
      params.settings &&
      params.settings.attachPDF &&
      res.resource &&
      res.resource.item &&
      res.resource.item._id
    ) {
      let url = `/project/${req.projectId}`;
      url += `/form/${req.formId}`;
      url += `/submission/${res.resource.item._id}`;
      url += '/download';
      const expireTime = 3600;
      formioServer.formio.auth.getTempToken(req, res, `GET:${url}`, expireTime, true, (err, token) => {
        if (err) {
          return resolve();
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
          fileName = FormioUtils.interpolate(fileName, {
            submission: res.resource.item,
            form: req.currentForm
          }).replace('.', '');
        }
        catch (err) {
          fileName = `submission-${ res.resource.item._id }`;
        }

        // Add the download token to the url.
        url += `?token=${token.key}`;
        mail.attachments = [
          {
            filename: `${fileName}.pdf`,
            contentType: 'application/pdf',
            path: `${config.apiHost}${url}`
          }
        ];
        return resolve();
      });
    }
    else {
      return resolve();
    }
  });

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

    const query = formioServer.formio.hook.alter('formQuery', {
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
      formioServer.formio.resources.form.model.find(query).exec((err, result) => {
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
          form: {'$in': forms},
          deleted: {$eq: null}
        };

        // Set the username field to the email address this is getting sent to.
        query[ssoToken.field] = {
          $regex: new RegExp(`^${formioServer.formio.util.escapeRegExp(mail.to)}$`),
          $options: 'i'
        };

        // Find the submission.
        formioServer.formio.resources.submission.model
          .findOne(query)
          .select('_id, form')
          .exec(function(err, submission) {
            ssoToken.submission = (err || !submission) ? null : submission;
            nextToken();
          });
      });
    }, () => {
      ssoTokens.forEach((ssoToken) => {
        if (ssoToken.submission) {
          ssoToken.token = formioServer.formio.hook.alter('token', {
            user: {
              _id: ssoToken.submission._id.toString()
            },
            form: {
              _id: ssoToken.submission.form.toString()
            }
          }, formObjs[ssoToken.submission.form.toString()]);
          delete ssoToken.token.exp;
          ssoToken.token = jwt.sign(ssoToken.token, formioServer.formio.config.jwt.secret, {
            expiresIn: ssoToken.expireTime * 60
          });
        }
      });

      // Replace the string token with the one generated here.
      let index = 0;
      mail.html = mail.html.replace(util.tokenRegex, () => {
        return ssoTokens[index++].token || 'INVALID_TOKEN';
      });

      // TO-DO: Generate the token for this user.
      return resolve(mail);
    });
  });

  checkPlan()
    .then(attachFiles)
    .then(attachPDF)
    .then(replaceSSOTokens)
    .then(mail => cb(null, mail))
    .catch(cb);
};
