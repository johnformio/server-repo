'use strict';

const _ = require('lodash');
const JiraClient = require('jira-connector');
const debug = {
  createIssue: require('debug')('formio:atlassian:createIssue'),
  updateIssue: require('debug')('formio:atlassian:updateIssue'),
  deleteIssue: require('debug')('formio:atlassian:deleteIssue'),
  checkSettings: require('debug')('formio:atlassian:checkSettings'),
  checkOAuth: require('debug')('formio:atlassian:checkOAuth'),
  authorizeOAuth: require('debug')('formio:atlassian:authorizeOAuth'),
  storeOAuthReply: require('debug')('formio:atlassian:storeOAuthReply')
};

module.exports = function(router) {
  const formio = router.formio;

  /**
   * Check to see if the connection settings are present.
   *
   * @param {Object} settings
   *   The project settings to check.
   *
   * @returns {boolean}
   *   Whether or not the settings are correct to connect to atlassian.
   */
  const checkSettings = function(settings) {
    if (!settings) {
      debug.checkSettings('No Project settings found');
      return false;
    }
    if (!settings.atlassian) {
      debug.checkSettings('No Atlassian settings configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.url')) {
      debug.checkSettings('No Atlassian URL is configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.username')) {
      debug.checkSettings('No Atlassian Username is configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.password')) {
      debug.checkSettings('No Atlassian Password is configured.');
      return false;
    }

    return true;
  };

  const checkOAuthSetting = function(settings) {
    if (!settings) {
      debug.checkSettings('No Project settings found');
      return false;
    }
    if (!settings.atlassian) {
      debug.checkSettings('No Atlassian settings configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.oauth.consumer_key')) {
      debug.checkSettings('No Atlassian OAuth Consumer Key is configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.oauth.private_key')) {
      debug.checkSettings('No Atlassian OAuth Private Key is configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.oauth.token')) {
      debug.checkSettings('No Atlassian OAuth Token is configured.');
      return false;
    }
    if (!_.has(settings, 'atlassian.oauth.token_secret')) {
      debug.checkSettings('No Atlassian OAuth Token Secret is configured.');
      return false;
    }

    return true;
  };

  const checkOAuth = function(settings) {
    if (!settings) {
      debug.checkOAuth('No OAuth settings found');
      return false;
    }

    if (!_.has(settings, 'oauth.consumer_key')) {
      debug.checkOAuth('No OAuth consumer key is configured');
      return false;
    }

    if (!_.has(settings, 'oauth.private_key')) {
      debug.checkOAuth('No OAuth private key is configured');
      return false;
    }

    return true;
  };

  const checkOAuthFinal = function(settings) {
    if (!checkOAuth(settings)) {
      return false;
    }

    if (!_.has(settings, 'oauth.token')) {
      debug.checkOAuth('No OAuth token is configured');
      return false;
    }

    if (!_.has(settings, 'oauth.token_secret')) {
      debug.checkOAuth('No OAuth token secret is configured');
      return false;
    }

    return true;
  };

  const storeOAuthReply = function(req, res, next) {
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug.storeOAuthReply(err);
        return res.sendStatus(400);
      }

      if (!_.has(settings, 'atlassian') || !checkOAuthFinal(_.get(settings, 'atlassian'))) {
        debug.storeOAuthReply('No atlassian Settings');
        return res.status(400).send('No atlassian Settings');
      }

      if (!_.has(req, 'body.oauth_verifier')) {
        debug.storeOAuthReply('No oauth_verifier given');
        return res.sendStatus(400);
      }

      try {
        /* eslint-disable camelcase */
        JiraClient.oauth_util.swapRequestTokenWithAccessToken({
          host: _.get(settings, 'atlassian.url'),
          oauth: {
            consumer_key: _.get(settings, 'atlassian.oauth.consumer_key'),
            private_key: _.get(settings, 'atlassian.oauth.private_key'),
            token: _.get(settings, 'atlassian.oauth.token'),
            token_secret: _.get(settings, 'atlassian.oauth.token_secret'),
            oauth_verifier: _.get(req, 'body.oauth_verifier')
          }
        }, function(err, accessToken) {
          if (err) {
            debug.storeOAuthReply(err);
            return res.sendStatus(400);
          }

          // Persist the real oauth token for any following requests.
          if (!req.projectId) {
            return res.sendStatus(400);
          }

          formio.cache.loadProject(req, formio.util.idToBson(req.projectId), function(err, project) {
            if (err) {
              debug.authorizeOAuth(err);
              return res.sendStatus(400);
            }

            const settings = _.cloneDeep(project.toObject().settings);
            _.set(settings, 'atlassian.oauth.token', accessToken);
            project.set('settings', settings);
            project.markModified('settings');
            project.save(function(err) {
              if (err) {
                debug.authorizeOAuth(err);
                return res.sendStatus(400);
              }

              return res.json({
                access_token: accessToken
              });
            });
          });
        });
        /* eslint-enable camelcase */
      }
      catch (e) {
        debug.storeOAuthReply('Error:');
        debug.storeOAuthReply(e);
        return res.status(400).send('Could not swap OAuth Access Token.');
      }
    });
  };

  const authorizeOAuth = function(req, res, next) {
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug.authorizeOAuth(err);
        return res.sendStatus(400);
      }

      if (!_.has(settings, 'atlassian') || !checkOAuth(_.get(settings, 'atlassian'))) {
        debug.authorizeOAuth('No atlassian Settings');
        return res.status(400).send('No atlassian Settings');
      }

      try {
        /* eslint-disable camelcase */
        JiraClient.oauth_util.getAuthorizeURL({
          host: _.get(settings, 'atlassian.url'),
          oauth: {
            consumer_key: _.get(settings, 'atlassian.oauth.consumer_key'),
            private_key: _.get(settings, 'atlassian.oauth.private_key')
          }
        }, function(err, handshake) {
          if (err) {
            debug.authorizeOAuth(err);
            return res.sendStatus(400);
          }

          if (!req.projectId) {
            return res.sendStatus(400);
          }

          formio.cache.loadProject(req, formio.util.idToBson(req.projectId), function(err, project) {
            if (err) {
              debug.authorizeOAuth(err);
              return res.sendStatus(400);
            }

            const settings = _.cloneDeep(project.toObject().settings);
            _.set(settings, 'atlassian.oauth.token', handshake.token);
            _.set(settings, 'atlassian.oauth.token_secret', handshake.token_secret);
            project.set('settings', settings);
            project.markModified('settings');
            project.save(function(err) {
              if (err) {
                debug.authorizeOAuth(err);
                return res.sendStatus(400);
              }

              debug.authorizeOAuth(handshake);
              res.json(handshake);
            });
          });
        });
        /* eslint-enable camelcase */
      }
      catch (e) {
        debug.authorizeOAuth('Error:');
        debug.authorizeOAuth(e);
        return res.status(400).send('Invalid OAuth settings given.');
      }
    });
  };

  return {
    storeOAuthReply: storeOAuthReply,
    authorizeOAuth: authorizeOAuth,
    getJira(settings) {
      const opts = {
        host: _.get(settings, 'atlassian.url')
      };

      /* eslint-disable camelcase */
      // If oauth settings are available, use them over basic auth
      if (checkOAuthSetting(settings)) {
        opts.oauth = {
          consumer_key: _.get(settings, 'atlassian.oauth.consumer_key'),
          private_key: _.get(settings, 'atlassian.oauth.private_key'),
          token: _.get(settings, 'atlassian.oauth.token'),
          token_secret: _.get(settings, 'atlassian.oauth.token_secret')
        };
      }
      else if (checkSettings(settings)) {
        opts.basic_auth = {
          username: _.get(settings, 'atlassian.username'),
          password: _.get(settings, 'atlassian.password')
        };
      }
      /* eslint-enable camelcase */

      try {
        return new JiraClient(opts);
      }
      catch (e) {
        return false;
      }
    },
    settings: {
      check: checkSettings
    }
  };
};
