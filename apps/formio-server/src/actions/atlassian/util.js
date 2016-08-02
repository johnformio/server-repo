'use strict';

var _ = require('lodash');
var JiraClient = require('jira-connector');
var debug = {
  createIssue: require('debug')('formio:atlassian:createIssue'),
  updateIssue: require('debug')('formio:atlassian:updateIssue'),
  deleteIssue: require('debug')('formio:atlassian:deleteIssue'),
  checkSettings: require('debug')('formio:atlassian:checkSettings'),
  checkOAuth: require('debug')('formio:atlassian:checkOAuth')
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

  router.use('/atlassian/oauth/authorize', function(req, res, next) {
    if (!checkOAuth(_.get(req, 'body'))) {
      return res.sendStatus(404);
    }

    JiraClient.oauth_util.getAuthorizeURL({
      consumer_key: _.get(req, 'body.oauth.consumer_key'),
      private_key: _.get(req, 'body.oauth.consumer_key')
    }, function(err, handshake) {
      if (err) {
        return res.sendStatus(404);
      }

      // Start the dance with the handshake.
      return res.json(handshake);
    });
  });

  return {
    getJira: function(settings) {
      return new JiraClient({
        host: _.get(settings, 'atlassian.url'),
        basic_auth: {
          username: _.get(settings, 'atlassian.username'),
          password: _.get(settings, 'atlassian.password')
        }
      });
    },
    settings: {
      check: checkSettings
    }
  }
};
