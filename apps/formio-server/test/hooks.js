'use strict';

let _ = require('lodash');
let assert = require('assert');

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
    },

    templateRoles: function(map) {
      let temp = [];

      Object.keys(map).forEach(role => {
        assert(map[role].hasOwnProperty('project'));

        let machineName = role.split(':');
        machineName = machineName.pop();

        // Remove the project from the role payload, for comparison in the open source tests.
        temp[machineName] = _.omit(map[role], ['project']);
      });

      return temp;
    }
  }
};
