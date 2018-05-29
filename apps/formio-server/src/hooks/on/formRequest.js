'use strict';

module.exports = app => (req, res) => {
  // Make sure to always include the projectId in POST and PUT calls.
  if (req.method === 'PUT' || req.method === 'POST') {
    req.body.project = req.projectId || req.params.projectId;
  }
};
