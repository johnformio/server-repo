'use strict';

var async = require('async');
var _ = require('lodash');

/**
 * Update 3.0.2-rc1
 *
 * This update takes all of the auth actions and turns them into a series of other actions that provide a more
 * flexible authentication system.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  var actionCollection = db.collection('actions');

  var updateHubSpot = function(then) {
    actionCollection.find({
      name: 'hubspotContact'
    }).snapshot({$snapshot: true}).toArray(function(err, actions) {
      if (err) {
        return then(err);
      }

      // Iterate through all of the actions.
      async.forEachOf(actions, function(action, key, next) {
        _.each(action.settings, function(value, key) {
          if (key.match(/_field$/) && value.indexOf('.') !== -1) {
            var parts = value.split('.');
            action.settings[key] = parts[1];
          }
        });

        actionCollection.update({_id: action._id}, {'$set': {settings: action.settings}});
        next();
      }, function(err) {
        if (err) {
          return then(err);
        }
        then();
      });
    });
  };

  async.series([
    updateHubSpot
  ], function(err) {
    if (err) {
      return done(err);
    }
    done();
  });
};
