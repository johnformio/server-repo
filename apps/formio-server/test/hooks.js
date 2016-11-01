'use strict';

var _ = require('lodash');

module.exports = {
  alter: {
    /**
     * Add the project path and _id to the request url.
     *
     * @param url
     * @param template
     * @returns {string}
     */
    url: function(url, template, projectName) {
      projectName = projectName || 'project';
      return '/project/' + template[projectName]._id + url;
    },

    webhookBody: function(body) {
      if (_.has(body, 'submission.externalTokens')) {
        delete body.submission.externalTokens;
      }

      return body;
    }
  }
};
