'use strict';

module.exports = (app) => (actions) => {
  const formioServer = app.formio;
  actions.oauth = require('../../actions/oauth/OAuthAction')(formioServer);
  actions.ldap = require('../../actions/LDAP')(formioServer);
  actions.googlesheet = require('../../actions/googlesheet/GoogleSheetAction')(formioServer);
  actions.sqlconnector = require('../../actions/sqlconnector/SQLConnector')(formioServer);
  actions.group = require('../../actions/GroupAction')(formioServer);
  actions.webhook = require('../../actions/webhook/WebhookAction')(formioServer);
  // actions.esign = require('../../actions/esign/ESignAction')(formioServer);
  actions.twofalogin = require('../../actions/twoFa/twofalogin')(formioServer);
  actions.twofarecoverylogin = require('../../actions/twoFa/twofarecoverylogin')(formioServer);
  return actions;
};
