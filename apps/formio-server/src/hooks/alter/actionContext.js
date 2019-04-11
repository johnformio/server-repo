'use strict';

module.exports = (app) => (params, req) => {
  params.config = req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {};
  return params;
};
