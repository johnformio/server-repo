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
      let temp = {};

      Object.keys(map).forEach(role => {
        assert(map[role].hasOwnProperty('project'));

        let machineName = role.split(':');
        machineName = machineName.pop();

        // Remove the project from the role payload, for comparison in the open source tests.
        temp[machineName] = _.omit(map[role], ['project']);
      });

      return temp;
    },

    templateFormsAndResources: function(map) {
      let temp = {};

      Object.keys(map).forEach(form => {
        assert(map[form].hasOwnProperty('project'));

        let machineName = form.split(':');
        machineName = machineName.pop();

        let entity = _.omit(map[form], ['project']);
        entity.access = entity.access.map(access => {
          access.roles =  access.roles.map(roleName => {
            return (roleName.split(':')).pop();
          });

          return access;
        });

        entity.submissionAccess = entity.submissionAccess.map(access => {
          access.roles = access.roles.map(roleName => {
            return (roleName.split(':')).pop();
          });

          return access;
        });

        // Remove the project from the role payload, for comparison in the open source tests.
        temp[machineName] = entity;
      });

      return temp;
    },

    templateActions: function(map) {
      let temp = {};

      Object.keys(map).forEach(action => {
        assert(map[action].hasOwnProperty('form'));

        let machineName = action.split(':');
        machineName = machineName.pop();

        let entity = map[action];
        let form = entity.form.split(':');
        form = form.pop();
        entity.form = form;

        if (entity.settings && entity.settings.resources) {
          entity.settings.resources = entity.settings.resources.map(resource => {
            return (resource.split(':')).pop();
          });
        }

        if (entity.settings && entity.settings.resource) {
          entity.settings.resource = (entity.settings.resource.split(':')).pop();
        }

        if (entity.settings && entity.settings.role) {
          if (!(entity.settings.role instanceof Array)) {
            entity.settings.role =(entity.settings.role.split(':')).pop();
            return;
          }

          console.log(entity.settings.role)
          entity.settings.role = entity.settings.role.map(resource => {
            return (resource.split(':')).pop();
          });
        }

        temp[machineName] = entity;
      });

      console.log(`temp: ${Object.keys(temp).length}`)
      console.log(Object.keys(temp))
      return temp;
    }
  }
};
