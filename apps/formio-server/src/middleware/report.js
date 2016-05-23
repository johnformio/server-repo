'use strict';

/**
 * This file serves as an aggregation mechanism for projecst.
 */
var express = require('express');
var router = express.Router();
var JSONStream = require('JSONStream');
var through = require('through');
var traverse = require('traverse');
var formioUtils = require('formio-utils');
var _ = require('lodash');
var debug = require('debug')('formio:middleware:report');

module.exports = function(formio) {
  var report = function(req, res, next, filter) {
    // A user is always required for this operation.
    if (!req.user || !req.user.roles || !req.user.roles.length) {
      debug('Unauthorized');
      return res.status(401).send('Unauthorized');
    }

    if (!req.body) {
      debug('No pipeline');
      return res.status(400).send('Must include an aggregation pipeline');
    }

    var mongoose = formio.mongoose;
    var submissions = mongoose.connections[0].collections.submissions.collection;

    // Make sure the filter is an array.
    if (!filter || !filter.length) {
      filter = [];
    }
    debug('filter', filter);

    var hasDisallowedStage = function() {
      // Ensure there are no disallowed stages in the aggregation.
      // We may want to include additional stages but better to start with less.
      var allowedStages = ['$match', '$limit', '$sort', '$skip', '$group', '$unwind'];
      for (var i in filter) {
        var stage = filter[i];
        for (var key in stage) {
          // Only allow boolean values for $project
          if (key === '$project') {
            for (var param in stage[key]) {
              if (['number', 'boolean'].indexOf((typeof stage[key][param])) === -1) {
                return true;
              }
            }
          }
          // Make sure that this is an allowed stage.
          else if (allowedStages.indexOf(key) === -1) {
            return true;
          }
        }
      }
      return false;
    };

    if (hasDisallowedStage()) {
      return res.status(400).send('Disallowed stage used in aggregation.');
    }

    // Convert ObjectIds to actual object ids.
    traverse(filter).forEach(function(node) {
      if (typeof node === 'string' && node.match(/^ObjectId\(\'(.{24})\'\)$/)) {
        var result = node.match(/^ObjectId\(\'(.{24})\'\)$/m);
        this.update(mongoose.Types.ObjectId(result[1]));
      }
    });

    // Get the user roles.
    var userRoles = _.map(req.user.roles, function(role) {
      return formio.mongoose.Types.ObjectId(role);
    });

    // Find all forms that this user has "read_all" access to or owns and only give them
    // aggregate access to those forms.
    formio.resources.form.model.find({
      '$and': [
        {project: mongoose.Types.ObjectId(req.projectId)},
        {'$or': [
          {access: {
            '$elemMatch': {
              type: 'read_all',
              roles: {
                '$in': userRoles
              }
            }
          }},
          {owner: mongoose.Types.ObjectId(req.user._id)}
        ]}
      ]
    }).exec(function(err, result) {
      if (err) {
        return next(err);
      }

      var formIds = [];
      var forms = {};

      // Add all these forms to a forms array.
      _.each(result, function(form) {
        formIds.push(form._id);
        forms[form._id.toString()] = form;
      });

      // Get the submission query.
      var submissionQuery = {form: {'$in': formIds}};
      if (!req.query.deleted) {
        submissionQuery.deleted = {$eq: null};
      }

      // Start out the filter to only include those forms.
      var pipeline = [{'$match': submissionQuery}].concat(filter);
      debug('final pipeline', pipeline);

      // Create the submission aggregate stream.
      submissions.aggregate(pipeline)
        .stream()
        .pipe(through(function(doc) {
          if (doc && doc.form) {
            var formId = doc.form.toString();
            if (forms.hasOwnProperty(formId)) {
              _.each(formioUtils.flattenComponents(forms[doc.form.toString()].components), function(component) {
                if (component.protected && doc.data && doc.data.hasOwnProperty(component.key)) {
                  delete doc.data[component.key];
                }
              });
            }
          }
          this.queue(doc);
        }))
        .pipe(JSONStream.stringify())
        .pipe(res);
    });
  };

  // Use post to crete aggregation criteria.
  router.post('/', function(req, res, next) {
    debug('POST', req.body);
    report(req, res, next, req.body);
  });

  // Allow them to provide the query via headers on a GET request.
  router.get('/', function(req, res, next) {
    var pipeline = [];
    if (req.headers.hasOwnProperty('x-query')) {
      debug('GET', req.headers['x-query']);
      try {
        pipeline = JSON.parse(req.headers['x-query']);
      }
      catch (err) {
        return res.status(400).send('Invalid query');
      }
    }

    // create the report.
    report(req, res, next, pipeline);
  });

  return router;
};
