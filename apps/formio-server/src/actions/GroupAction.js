'use strict';

var _ = require('lodash');
var debug = {
  settingsForm: require('debug')('formio:actions:GroupAction#settingsForm'),
  resolve: require('debug')('formio:actions:GroupAction#resolve')
};

module.exports = function(router) {
  var Action = router.formio.Action;
  var hook = router.formio.hook;

  /**
   * GroupAction class.
   *   This class is used to create the Role action.
   *
   * @constructor
   */
  var GroupAction = function(data, req, res) {
    Action.call(this, data, req, res);
  };

  // Derive from Action.
  GroupAction.prototype = Object.create(Action.prototype);
  GroupAction.prototype.constructor = GroupAction;
  GroupAction.info = function(req, res, next) {
    next(null, {
      name: 'group',
      title: 'Group Assignment (Premium)',
      premium: true,
      description: 'Provides the Group Assignment capabilities.',
      priority: 5,
      defaults: {
        handler: ['after'],
        method: ['create']
      },
      access: {
        handler: false,
        method: false
      }
    });
  };
  GroupAction.settingsForm = function(req, res, next) {
    var basePath = hook.alter('path', '/form', req);
    var dataSrc = basePath + '/' + req.params.formId + '/components';
    next(null, [
      {
        type: 'select',
        input: true,
        label: 'Group Resource',
        key: 'group',
        placeholder: 'Select the Group Resource field',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false,
        validate: {
          required: true
        }
      },
      {
        type: 'select',
        input: true,
        label: 'User Resource',
        key: 'user',
        placeholder: 'self',
        template: '<span>{{ item.label || item.key }}</span>',
        dataSrc: 'url',
        data: {url: dataSrc},
        valueProperty: 'key',
        multiple: false,
        validate: {
          required: false
        }
      }
    ]);
  };

  /**
   * Add the group roles to the user.
   *
   * @param handler
   *   TODO
   * @param method
   *   TODO
   * @param req
   *   The Express request object.
   * @param res
   *   The Express response object.
   * @param next
   *   The callback function to execute upon completion.
   */
  GroupAction.prototype.resolve = function(handler, method, req, res, next) {
    try {
      var group = _.get(this.settings, 'group');
      group = _.get(req.submission, 'data.' + group); // Set the group to its search value.
      var user = _.get(this.settings, 'user');

      // Check for required settings.
      if (!group) {
        debug.resolve('Cant resolve the action, because no group was set.');
        debug.resolve(this.settings);
        debug.resolve(req.submission);
        return res.status(400).send('Can not resolve the action, because no group was set.');
      }

      // Check for the user, either just created (with this) or defined in the submission.
      var userDefined = user && _.has(req.submission, 'data.' + user);
      var thisUser = !user && _.has(res, 'resource.item');
      if (!userDefined && !thisUser) {
        return res.status(400).send('A User reference is required for group assignment.');
      }
      debug.resolve('userDefined: ' + userDefined);
      debug.resolve('thisUser: ' + thisUser);

      // Search for the user within the cache.
      var searchUser = userDefined
        ? _.get(req.submission, 'data.' + user)
        : _.get(res, 'resource.item._id');
      debug.resolve('searchUser: ' + JSON.stringify(searchUser));
      // If the _id is present in a resource object, then pluck only the _id.
      if (_.has(searchUser, '_id')) {
        searchUser = _.get(searchUser, '_id');
      }

      router.formio.resources.form.model.aggregate(
        {$match: {project: router.formio.util.idToBson(_.get(req, 'projectId'))}},
        {$project: {_id: 1}},
        {$lookup: {from: 'submissions', localField: '_id', foreignField: 'form', as: 'submissions'}},
        {$match: {submissions: {$exists: true, $ne: []}}},
        {$unwind: '$submissions'},
        {$match: {'submissions._id': router.formio.util.idToBson(searchUser)}},
        function(err, submission) {
          if (err || !submission || submission.length !== 1) {
            debug.resolve(err || 'Submission: ' + (!submission ? 'none' : submission.length));
            return res.status(400).send('Could not load the user for group assignment.');
          }

          // We only want to deal with the single result.
          submission = submission.pop();
          submission = _.get(submission, 'submissions'); // unwrap the submission obj from the unwind op.

          // TODO: Make sure the group id is a valid bson _id, within the current projects scope and the assignee has
          // TODO: write/admin access to it.
          // Add the new role and make sure its unique.
          var newRoles = submission.roles || [];
          newRoles.map(router.formio.util.idToString);
          newRoles.push(router.formio.util.idToString(group));
          newRoles = _.uniq(newRoles);
          newRoles.map(router.formio.util.idToBson);

          router.formio.resources.submission.model.update(
            {
              _id: router.formio.util.idToBson(submission._id),
              deleted: {$eq: null}
            },
            {
              $set: {
                roles: newRoles
              }
            },
            function(err) {
              if (err) {
                debug.resolve(err);
                return res.status(400).send('Could not add the given group role to the user.');
              }

              // Attempt to update the response item, if present.
              if (thisUser) {
                _.set(res, 'resource.item.roles');
              }

              return next();
            }
          )
        }
      )
    }
    catch (e) {
      debug.resolve(e);
      return next();
    }
  };

  // Return the GroupAction.
  return GroupAction;
};
