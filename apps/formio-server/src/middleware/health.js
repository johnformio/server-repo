'use strict';

var _ = require('lodash');
var debug = require('debug')('formio:middleware:health');

module.exports = function(formio) {
  return function(req, res, next) {
    if (!formio.resources) {
      return res.status(500).send('No Resources');
    }
    if (!formio.resources.project.model) {
      return res.status(500).send('No Project model');
    }

    formio.resources.project.model.findOne({primary: true}, function(err, result) {
      if (err) {
        return res.status(500).send(err);
      }
      if (!result) {
        return res.status(500).send('No Primary Project not found');
      }

      // Proceed with db schema sanity check middleware.
      return next();
    });
  }
}
