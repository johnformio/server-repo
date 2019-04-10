'use strict';

module.exports = (app) => (req, params) => {
  params.config = req.currentProject && req.currentProject.hasOwnProperty('config') ? req.currentProject.config : {};
  return params;
};
