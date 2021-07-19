'use strict';
const Q = require('q');
const util = require('../util/util');
module.exports = function(formio) {
  /**
   * Authenticate a user via OAuth. Resolves with null if no user found
   *
   * @param form
   * @param providerName
   * @param oauthId
   * @param next
   *
   * @returns {Promise}
   */
  const authenticateOAuth = function(form, providerName, oauthId, req, next) {
    if (!providerName) {
      return next(new Error('Missing provider'));
    }
    if (!oauthId) {
      return next(new Error('Missing OAuth ID'));
    }

    return Q(formio.resources.submission.model.findOne(
      {
        form: form._id,
        externalIds: {
          $elemMatch: {
            type: providerName,
            id: oauthId
          }
        },
        deleted: {$eq: null}
      }
    ))
    .then(function(user) {
      if (!user) {
        return null;
      }

      const sessionModel = formio.mongoose.models.session;

      return sessionModel.create({
        project: form.project,
        form: form._id,
        submission: user._id,
      })
        .catch(next)
        .then((session) => {
          // Respond with a token.
          const token = {
            user: {
              _id: user._id,
              roles: user.roles
            },
            form: {
              _id: form._id,
              project: form.project
            },
            project: {
              _id: form.project
            },
            source: `oauth:${providerName}`,
          };
          token.iss = util.baseUrl(formio, req);
          token.sub = token.user._id;
          token.jti = session._id;

          return {
            user: user,
            token: {
              token: formio.auth.getToken(token),
              decoded: token
            }
          };
        });
    })
    .nodeify(next);
  };

  /**
   * Return the public methods.
   */
  return {
    authenticateOAuth: authenticateOAuth
  };
};
