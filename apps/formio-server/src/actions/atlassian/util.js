'use strict';

var _ = require('lodash');
var JiraClient = require('jira-connector');
var debug = {
  createIssue: require('debug')('formio:atlassian:createIssue'),
  updateIssue: require('debug')('formio:atlassian:updateIssue'),
  deleteIssue: require('debug')('formio:atlassian:deleteIssue'),
  checkSettings: require('debug')('formio:atlassian:checkSettings')
};

module.exports = function(router) {
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
