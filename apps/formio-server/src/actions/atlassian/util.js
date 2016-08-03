'use strict';

var _ = require('lodash');
var JiraClient = require('jira-connector');
var debug = {
  createIssue: require('debug')('formio:atlassian:createIssue'),
  updateIssue: require('debug')('formio:atlassian:updateIssue'),
  deleteIssue: require('debug')('formio:atlassian:deleteIssue'),
  checkSettings: require('debug')('formio:atlassian:checkSettings'),
  checkOAuth: require('debug')('formio:atlassian:checkOAuth'),
  OAuthAuthorize: require('debug')('formio:atlassian:OAuthAuthorize')
};

module.exports = function(router) {
  var formio = router.formio;

  /**
   * Check to see if the connection settings are present.
   *
   * @param {Object} settings
   *   The project settings to check.
   *
   * @returns {boolean}
   *   Whether or not the settings are correct to connect to atlassian.
   */
  var checkSettings = function(settings) {
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

  var checkOAuth = function(settings) {
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

  var storeOAuthReply = function(data) {

  };

  var authorizeOAuth = function(req, res, next) {
    formio.hook.settings(req, function(err, settings) {
      if (err) {
        debug.OAuthAuthorize(err);
        return res.sendStatus(400);
      }

      if (!_.has(settings, 'atlassian') || !checkOAuth(_.get(settings, 'atlassian'))) {
        debug.OAuthAuthorize('No atlassian Settings');
        return res.sendStatus(400);
      }

      JiraClient.oauth_util.getAuthorizeURL({
        host: _.get(settings, 'atlassian.url'),
        oauth: {
          consumer_key: _.get(settings, 'atlassian.oauth.consumer_key'),
          private_key: _.get(settings, 'atlassian.oauth.private_key')
        }
      }, function(err, handshake) {
        if (err) {
          debug.OAuthAuthorize(err);
          return res.sendStatus(400);
        }

        // Start the dance with the handshake.
        debug.OAuthAuthorize(handshake);
        return res.json(handshake);
      });
    });
  };

  return {
    authorizeOAuth: authorizeOAuth,
    getJira: function(settings) {
      var opts = {
        host: _.get(settings, 'atlassian.url')
      };

      // If oauth settings are available, use them over basic auth
      if (checkOAuth(settings)) {
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

      return new JiraClient(opts);
    },
    settings: {
      check: checkSettings
    }
  }
};
