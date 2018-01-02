'use strict';

const jwt = require('jsonwebtoken');
const util = require('../../util/util');

module.exports = app => (mail, req, res, params, cb) => {
  const formioServer = app.formio;
  const _debug = require('debug')('formio:hook:email');

  _debug(mail);
  if (mail.to.indexOf(',') !== -1) {
    return cb(null, mail);
  }

  // Find the ssoToken.
  const ssoToken = util.ssoToken(mail.html);
  if (!ssoToken) {
    _debug(`No ssoToken`);
    return cb(null, mail);
  }

  const query = formioServer.formio.hook.alter('formQuery', {
    name: {'$in': ssoToken.resources},
    deleted: {$eq: null}
  }, req);

  // Find the forms to search the record within.
  _debug(query);
  formioServer.formio.resources.form.model.find(query).exec((err, result) => {
    if (err || !result) {
      _debug(err || `No form was found`);
      return cb(err, mail);
    }

    const forms = [];
    const formObjs = {};
    result.forEach(function(form) {
      formObjs[form._id.toString()] = form;
      forms.push(form._id);
    });

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
    _debug(query);
    formioServer.formio.resources.submission.model
      .findOne(query)
      .select('_id, form')
      .exec(function(err, submission) {
        if (err || !submission) {
          _debug(err || `No submission found`);
          return cb(null, mail);
        }

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
        _debug(mail);
        return cb(null, mail);
      });
  });
};
