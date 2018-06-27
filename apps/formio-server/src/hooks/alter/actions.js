'use strict';

module.exports = (app) => (actions) => {
  const formioServer = app.formio;
  actions.office365contact = require('../../actions/office365/Office365Contact')(formioServer);
  actions.office365calendar = require('../../actions/office365/Office365Calendar')(formioServer);
  actions.hubspotContact = require('../../actions/hubspot/hubspotContact')(formioServer);
  actions.oauth = require('../../actions/oauth/OAuthAction')(formioServer);
  actions.ldap = require('../../actions/LDAP')(formioServer);
  actions.googlesheet = require('../../actions/googlesheet/googleSheet')(formioServer);
  actions.sqlconnector = require('../../actions/sqlconnector/SQLConnector')(formioServer);
  actions.jira = require('../../actions/atlassian/jira')(formioServer);
  actions.group = require('../../actions/GroupAction')(formioServer);
  actions.moxtraLogin = require('../../actions/moxtra/MoxtraLogin')(formioServer);
  actions.moxtraMessage = require('../../actions/moxtra/MoxtraMessage')(formioServer);
  actions.moxtraTodo = require('../../actions/moxtra/MoxtraTodo')(formioServer);
  actions.webhook = require('../../actions/WebhookAction')(formioServer);
  actions.twilio = require('../../actions/twilio/twilio')(formioServer);
  return actions;
};
