'use strict';

const jwt = require('jsonwebtoken');
const util = require('../../util/util');

module.exports = app => (mail, req, res, params, cb) => {
  const formioServer = app.formio;

  const limits = {
    basic: 100,
    independent: 1000
  };
  const plans = Object.keys(limits);

  const checkPlan = new Promise((resolve, reject) => {
    // Restrict basic and independent plans.
    if (req && req.primaryProject) {
      if (plans.includes(req.primaryProject.plan)) {
        if (mail.transport !== 'default') {
          return reject('Plan limited to default transport only.');
        }
        if (formioServer.redis && formioServer.redis.db) {
          /* eslint-disable max-len */
          const redisKey = `email:${req.currentProject._id.toString()}:${(new Date()).getUTCFullYear().toString()}${((new Date()).getUTCMonth() + 1).toString()}`;
          /* eslint-enable max-len */
          formioServer.redis.db.get(redisKey, (err, emailCount) => {
            if (err) {
              return reject(err);
            }
            emailCount = parseInt(emailCount) || 0;
            if (emailCount > limits[req.primaryProject.plan]) {
              return reject('Over email limit');
            }
            formioServer.redis.db.set(redisKey, emailCount + 1);
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
      const ssoToken = util.ssoToken(mail.html);
      if (!ssoToken) {
        return cb(null, mail);
      }

      const query = formioServer.formio.hook.alter('formQuery', {
        deleted: {$eq: null}
      }, req);

      // Check to see if this needs to generate a token based on the current submission.
      const inlineResource = (!ssoToken.resources || !ssoToken.resources.length) && res.resource && res.resource.item;

      if (inlineResource) {
        // This is an inline token generation from current submission.
        query._id = res.resource.item.form;
      }
      else {
        query.name = {'$in': ssoToken.resources};
      }

      // Find the forms to search the record within.
      formioServer.formio.resources.form.model.find(query).exec((err, result) => {
        if (err || !result) {
          return cb(err, mail);
        }

        const forms = [];
        const formObjs = {};
        result.forEach(function(form) {
          formObjs[form._id.toString()] = form;
          forms.push(form._id);
        });

        const getSubmission = function(next) {
          if (inlineResource) {
            return next(res.resource.item);
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
              if (err || !submission) {
                return cb(null, mail);
              }

              next(submission);
            });
        };

        getSubmission(function(submission) {
          // Create a new JWT token for the SSO.
          let token = formioServer.formio.hook.alter('token', {
            user: {
              _id: submission._id.toString()
            },
            form: {
              _id: submission.form.toString()
            }
          }, formObjs[submission.form.toString()]);

          // Make sure this token does not have an expiration.
          delete token.exp;

          // Create a token that expires in 30 minutes.
          token = jwt.sign(token, formioServer.formio.config.jwt.secret, {
            expiresIn: ssoToken.expireTime * 60
          });

          // Replace the string token with the one generated here.
          mail.html = mail.html.replace(util.tokenRegex, token);

          // TO-DO: Generate the token for this user.
          return cb(null, mail);
        });
      });
    })
    .catch(cb);
};
