'use strict';

const Q = require('q');
const _ = require('lodash');
const debug = {
  settingsForm: require('debug')('formio:actions:GroupAction#settingsForm'),
  resolve: require('debug')('formio:actions:GroupAction#resolve'),
  canAssignGroup: require('debug')('formio:actions:GroupAction#canAssignGroup'),
  loadFilteredSubmission: require('debug')('formio:actions:GroupAction#loadFilteredSubmission')
};

module.exports = function(router) {
  const Action = router.formio.Action;
  const hook = router.formio.hook;

  /**
   * GroupAction class.
   *   This class is used to create the Role action.
   */
  class GroupAction extends Action {
    constructor(data, req, res) {
      super(data, req, res);
    }

    static info(req, res, next) {
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
    }

    static settingsForm(req, res, next) {
      const basePath = hook.alter('path', '/form', req);
      const dataSrc = `${basePath}/${req.params.formId}/components`;
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
    }

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
    resolve(handler, method, req, res, next) {
      if (_.get(router, 'formio.config.mongo', '').indexOf('documents.azure.com') !== -1) {
        return res.status(400).send('MongoDB Aggregation is not supported in Azure Cosmos DB');
      }

      try {
        /**
         * Load the submission with the given _id, but using the current project as a filter restriction.
         *
         * @param name
         * @param id
         * @returns {*}
         */
        const loadFilteredSubmission = function(name, id) {
          const deferred = Q.defer();

          const filter = {deleted: {$eq: null}};
          filter[name] = {$exists: true, $ne: []};

          const match = {};
          match[`${name}._id`] = router.formio.util.idToBson(id);

          router.formio.resources.form.model.aggregate(
            {$match: {project: router.formio.util.idToBson(_.get(req, 'projectId')), deleted: {$eq: null}}},
            {$project: {_id: 1}},
            {$lookup: {from: 'submissions', localField: '_id', foreignField: 'form', as: name}},
            {$match: filter},
            {$unwind: `$${name}`},
            {$match: match},
            function(err, submissions) {
              if (err || !submissions || submissions.length !== 1) {
                debug.loadFilteredSubmission(err || `Submission: ${!submissions ? 'none' : submissions.length}`);
                deferred.reject(`Could not the ${name} for assignment.`);
              }

              // We only want to deal with the single result.
              debug.loadFilteredSubmission(submissions);
              submissions = submissions.pop();

              // unwrap the submission obj from the unwind op.
              deferred.resolve(_.get(submissions, name));
            }
          );

          return deferred.promise;
        };

        /**
         * Check if the current user has request to edit the given group.
         *
         * @param gid
         * @returns {*}
         */
        const canAssignGroup = function(gid) {
          return loadFilteredSubmission('group', gid)
          .then(function(group) {
            const context = _.cloneDeep(req);
            context.permissionsChecked = false;
            context.formioCache = hook.alter('cacheInit', {
              names: {},
              aliases: {},
              forms: {},
              submissions: {}
            });
            context.method = 'PUT'; // the user must have update access to the group for assignment access.
            context.formId = router.formio.util.idToString(group.form);
            context.subId = router.formio.util.idToString(group._id);

            debug.loadFilteredSubmission(group);
            debug.loadFilteredSubmission(`context.formId: ${context.formId}`);
            debug.loadFilteredSubmission(`context.subId: ${context.subId}`);

            const deferred = Q.defer();
            router.formio.middleware.permissionHandler(context, res, function(err) {
              if (err) {
                debug.canAssignGroup(err);
                deferred.reject(err);
              }

              deferred.resolve(true);
            });

            return deferred.promise;
          });
        };

        const user = _.get(this.settings, 'user');
        let group = _.get(this.settings, 'group');
        group = _.get(req.submission, `data.${group}`); // Set the group to its search value.
        // If the _id is present in a resource object, then pluck only the _id.
        if (_.has(group, '_id')) {
          group = _.get(group, '_id');
        }

        // Check for required settings.
        if (!group) {
          debug.resolve('Cant resolve the action, because no group was set.');
          debug.resolve(this.settings);
          debug.resolve(req.submission);
          return res.status(400).send('Can not resolve the action, because no group was set.');
        }

        // Check for the user, either just created (with this) or defined in the submission.
        const userDefined = user && _.has(req.submission, `data.${user}`);
        const thisUser = !user && _.has(res, 'resource.item');
        if (!userDefined && !thisUser) {
          return res.status(400).send('A User reference is required for group assignment.');
        }
        debug.resolve(`userDefined: ${userDefined}`);
        debug.resolve(`thisUser: ${thisUser}`);

        // Search for the user within the cache.
        let searchUser = userDefined
          ? _.get(req.submission, `data.${user}`)
          : _.get(res, 'resource.item._id');
        // If the _id is present in a resource object, then pluck only the _id.
        if (_.has(searchUser, '_id')) {
          searchUser = _.get(searchUser, '_id');
        }

        loadFilteredSubmission('user', searchUser)
        .then(function(user) {
          return canAssignGroup(group)
          .then(function() {
            const deferred = Q.defer();

            // Add the new role and make sure its unique.
            let newRoles = user.roles || [];
            newRoles.map(router.formio.util.idToString);
            newRoles.push(router.formio.util.idToString(group));
            newRoles = _.uniq(newRoles);
            debug.canAssignGroup('newRoles:');
            debug.canAssignGroup(newRoles);
            newRoles.map(router.formio.util.idToBson);

            router.formio.resources.submission.model.update(
              {
                _id: router.formio.util.idToBson(user._id),
                deleted: {$eq: null}
              },
              {
                $set: {
                  roles: newRoles
                }
              },
              function(err) {
                if (err) {
                  debug.canAssignGroup(err);
                  throw new Error('Could not add the given group role to the user.');
                }

                // Attempt to update the response item, if present.
                if (thisUser) {
                  _.set(res, 'resource.item.roles', newRoles);
                  debug.canAssignGroup(res.resource.item);
                }

                debug.canAssignGroup(`Updated: ${user._id}`);
                return deferred.fulfill();
              }
            );

            return deferred.promise;
          })
          .then(next);
        })
        .catch(function(err) {
          debug.resolve(err);
          return res.status(400).send(err);
        });
      }
      catch (e) {
        debug.resolve(e);
        return next();
      }
    }
  }

  // Return the GroupAction.
  return GroupAction;
};
