'use strict';

var async = require('async');
var _ = require('lodash');

/**
 * Update 3.0.4-rc1
 *
 * Clean up orphaned actions, and ensure that all actions have a machine name.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  var actionCollection = db.collection('actions');
  var formCollection = db.collection('forms');
  var projectCollection = db.collection('projects');

  // Ensure that the machine name is unique.
  var setMachineName = function(action, machineName, index, done) {
    index = index || 0;
    var uniqueName = machineName;
    if (index) {
      uniqueName += index;
    }
    actionCollection.findOne({machineName: uniqueName}, function(err, foundAction) {
      if (foundAction && foundAction._id) {
        setMachineName(action, machineName, ++index, done);
      }
      else {

        // Update the action.
        actionCollection.update({_id: action._id}, {'$set': {machineName: uniqueName}}, function(err) {
          done(err);
        });
      }
    });
  };

  actionCollection.find({}).snapshot({$snapshot: true}).toArray(function(err, actions) {
    if (err) {
      return then(err);
    }

    // Iterate through all of the actions.
    async.forEachOf(actions, function(action, key, next) {

      // If this action already has a machine name.
      if (action.machineName) {
        return next();
      }

      // Load the form.
      formCollection.findOne({_id: action.form}, function(err, form) {
        if (err) {
          return next();
        }

        if (!form || !form.project) {
          // This is an orphaned action... clean it up.
          actionCollection.remove({_id: action._id});
        }

        // Load the project
        projectCollection.findOne({_id: form.project}, function(err, project) {
          if (err || !project) {
            return next();
          }

          var machineName = project.name + ':' + form.name + ':' + action.name;
          setMachineName(action, machineName, 0, function() {
            next();
          });
        });
      });
    }, function(err) {
      if (err) {
        return done(err);
      }
      done();
    });
  });
};
