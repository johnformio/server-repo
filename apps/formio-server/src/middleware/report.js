/**
 * This file serves as an aggregation mechanism for projecst.
 */
var express = require('express');
var router = express.Router();
var JSONStream = require('JSONStream');
var through = require('through');
var formioUtils = require('formio-utils');
var _ = require('lodash');

module.exports = function(formio) {
  var report = function(req, res, filter) {
    // A user is always required for this operation.
    if (!req.user || !req.user.roles || !req.user.roles.length) {
      return res.status(401).send('Unauthorized');
    }

    if (!req.body) {
      return res.status(400).send('Must include an aggregation pipeline');
    }

    // Make sure the filter is an array.
    if (!filter || !filter.length) {
      filter = [];
    }

    // Get the user roles.
    var userRoles = _.map(req.user.roles, function(role) {
      return formio.mongoose.Types.ObjectId(role);
    });

    var mongoose = formio.mongoose;
    var submissions = mongoose.connections[0].collections.submissions.collection;

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

      // Start out the filter to only include those forms.
      var pipeline = [{'$match': {form: {'$in': formIds}}}].concat(filter);

      // Create the submission aggregate stream.
      submissions.aggregate(pipeline)
        .stream()
        .pipe(through(function(doc) {
          if (doc && doc.form) {
            var formId = doc.form.toString();
            if (forms.hasOwnProperty(formId)) {
              _.each(formioUtils.flattenComponents(forms[doc.form.toString()].components), function(component) {
                if (component.protected) {
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
  router.post('/', function(req, res) {
    report(req, res, req.body);
  });

  // Allow them to provide the query via headers on a GET request.
  router.get('/', function(req, res) {
    var pipeline = [];
    if (req.headers.hasOwnProperty('x-query')) {
      try {
        pipeline = JSON.parse(req.headers['x-query']);
      }
      catch (err) {
        return res.status(400).send('Invalid query');
      }
    }

    // create the report.
    report(req, res, pipeline);
  });

  return router;
};
