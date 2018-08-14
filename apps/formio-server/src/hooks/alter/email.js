'use strict';

const jwt = require('jsonwebtoken');
const util = require('../../util/util');
const async = require('async');

module.exports = app => (mail, req, res, params, cb) => {
  const formioServer = app.formio;
  const checkPlan = new Promise((resolve, reject) => {
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

  checkPlan
    .then(() => {
      if (mail.to.indexOf(',') !== -1) {
        return cb(null, mail);
      }

      // Find the ssoToken.
      const ssoTokens = util.ssoTokens(mail.html);
      if (!ssoTokens || !ssoTokens.length) {
        return cb(null, mail);
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
        return cb(null, mail);
      });
    })
    .catch(cb);
};
