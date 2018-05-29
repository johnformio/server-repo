'use strict';

const o365Util = require('../../actions/office365/util');
const _ = require('lodash');

module.exports = app => (transport, settings, projectSettings, req, res, params) => {
  const transporter = {};
  if ((transport === 'outlook') && projectSettings.office365.email) {
    transporter.sendMail = function(mail) {
      o365Util.request(app.formio, req, res, 'sendmail', 'Office365Mail', 'application', {
        Message: {
          Subject: mail.subject,
          Body: o365Util.getBodyObject(mail.html),
          ToRecipients: o365Util.getRecipientsObject(_.map(mail.to.split(','), _.trim)),
          From: o365Util.getRecipient(projectSettings.office365.email)
        }
      });
    };
  }
  return transporter;
};
