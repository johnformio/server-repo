'use strict';

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

    webhookServer: function(server, app, template, next) {
      if (!app || !template.project) {
        return next(null, server);
      }

      var helper = new template.Helper();
      helper.setProjectPlan.call({template: template}, 'team', function() {
        return next(null, server);
      });
    }
  }
};
