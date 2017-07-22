'use strict';

/**
 * This file serves as an aggregation mechanism for projects.
 */
var express = require('express');
var router = express.Router();
var JSONStream = require('JSONStream');
var through = require('through');
var traverse = require('traverse');
var formioUtils = require('formiojs/utils');
var paginate = require('node-paginate-anything');
var _ = require('lodash');
var debug = {
  report: require('debug')('formio:middleware:report'),
  error: require('debug')('formio:error')
};

module.exports = function(formioServer) {
  var formio = formioServer.formio;
  var cache = require('../cache/cache')(formio);
  return function(req, res, next) {
    // Only allow access key to change owner for now.
    if (req.projectId && process.env.ACCESS_KEY && process.env.ACCESS_KEY === req.headers['access-key']) {
      cache.loadCurrentProject(req, (err, project) => {
        if (err) {
          return next(err);
        }
        if (!project) {
          return res.status(404).send('Project not found');
        }
        project.owner = formioServer.formio.util.idToBson(req.body.owner);
        project.markModified('owner');
        project.save();
        return res.send(project.toObject());
      });
    }
    else {
      return res.status(401).send();
    }
  };
};
