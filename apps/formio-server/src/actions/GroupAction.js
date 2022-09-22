'use strict';

const _ = require('lodash');
const debug = {
  settingsForm: require('debug')('formio:actions:GroupAction#settingsForm'),
  resolve: require('debug')('formio:actions:GroupAction#resolve'),
  canAssignGroup: require('debug')('formio:actions:GroupAction#canAssignGroup'),
  loadSubmission: require('debug')('formio:actions:GroupAction#loadSubmission'),
};

const filterAsync = (array, predicate) => Promise.all(array.map(predicate))
  .then((results) => array.filter((item, index) => results[index]));

module.exports = (router) => {
  const {
    Action,
    hook,
    middleware: {
      permissionHandler,
    },
    util: {
      idToBson,
      idToString,
    },
  } = router.formio;

  /**
   * GroupAction class.
   *   This class is used to create the Role action.
   */
  class GroupAction extends Action {
    static info(req, res, next) {
      next(null, {
        name: 'group',
        title: 'Group Assignment (Premium)',
        premium: true,
        description: 'Provides the Group Assignment capabilities.',
        priority: 5,
        defaults: {
          handler: ['after'],
          method: ['create', 'update', 'delete'],
        },
        access: {
          handler: false,
          method: false,
        },
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
            required: true,
          },
          filter: "type=select&dataSrc=resource",
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
            required: false,
          },
          filter: "type=select&dataSrc=resource",
        },
        {
          type: 'select',
          input: true,
          label: 'User Role',
          key: 'role',
          placeholder: 'Select the User Role field',
          template: '<span>{{ item.label || item.key }}</span>',
          dataSrc: 'url',
          data: {url: dataSrc},
          valueProperty: 'key',
          multiple: false,
          validate: {
            required: false,
          },
        },
      ]);
    }

    getGroups(submission, groupSelector, roleSelector) {
      const newGroupIds = this.getGroupIds(submission, groupSelector);
      const newGroupRoles = this.getGroupRoles(submission, roleSelector);

      return this.applyRolesToGroups(newGroupIds, newGroupRoles);
    }

    getGroupIds(submission, selector) {
      const groups = [].concat(_.get(submission, `data.${selector}`, []));
      return _.chain(groups)
        .map((group) => _.get(group, '_id', group))
        .map(idToString)
        .compact()
        .uniq()
        .value();
    }

    getGroupRoles(submission, selector) {
      const roles = [].concat(_.get(submission, `data.${selector}`, []));
      return _.chain(roles)
        .compact()
        .uniq()
        .value();
    }

    getUserId(submission, selector) {
      const user = _.get(submission, `data.${selector}`);
      return idToString(_.get(user, '_id', user));
    }

    applyRolesToGroups(ids, roles) {
      return roles.length
        ? ids.flatMap((id) => roles.map((role) => (`${id}:${role}`)))
        : ids;
    }

    loadSubmission(name, submissionId, submissionModel) {
      return submissionModel.findOne({
        _id: idToBson(submissionId),
        project: idToBson(this.req.projectId),
        deleted: {$eq: null},
      })
        .then((submission) => {
          if (!submission) {
            debug.loadSubmission(`Could not find the ${name} for assignment.`);
            throw new Error(`Could not find the ${name} for assignment.`);
          }

          return submission;
        })
        .catch(((err) => {
          throw new Error(`Could not find the ${name} resource for group assignment action.`);
        }));
    }

    verifyGroupAccess(groupId, submissionModel) {
      const [id] = groupId.split(':');
      return this.loadSubmission('group', id, submissionModel)
        .then((group) => {
          const context = _.cloneDeep(this.req);
          context.permissionsChecked = false;
          context.formioCache = hook.alter('cacheInit', {
            names: {},
            aliases: {},
            forms: {},
            submissions: {},
          });
          context.method = 'PUT'; // the user must have update access to the group for assignment access.
          context.formId = idToString(group.form);
          context.subId = idToString(group._id);

          return new Promise((resolve) => {
            permissionHandler(context, this.res, (err) => {
              if (err) {
                debug.canAssignGroup(err);
                return resolve(false);
              }

              resolve(true);
            });
          });
        });
    }

    applyRoleChanges(userId, rolesToAdd, rolesToRemove, submissionModel) {
      return this.loadSubmission('user', userId, submissionModel)
        .then((user) => Promise.all([
            filterAsync(rolesToAdd, (groupId) => this.verifyGroupAccess(groupId, submissionModel)),
            filterAsync(rolesToRemove, (groupId) => this.verifyGroupAccess(groupId, submissionModel)),
          ])
            .then(([
              verifiedGroupsToAdd,
              verifiedGroupsToRemove,
            ]) => {
              const {
                roles = [],
              } = user;

              const newRoles = _.chain(roles)
                .map(idToString)
                .concat(verifiedGroupsToAdd)
                .difference(verifiedGroupsToRemove)
                .uniq()
                .map(idToBson)
                .value();

              return submissionModel.updateOne(
                {
                  _id: idToBson(userId),
                  project: idToBson(this.req.projectId),
                  deleted: {$eq: null},
                },
                {
                  '$set': {
                    roles: newRoles,
                  },
                },
              )
                .then(() => newRoles);
            }),
        );
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
      new Promise((resolve, reject) => {
        const collectionName = req.model && req.model.modelName ? req.model.modelName : router.formio.resources.submission.modelName;
        const submissionModel = router.formio.mongoose.model(
          collectionName,
          router.formio.schemas.submission);
        const userSelector = _.get(this.settings, 'user');
        const thisUser = !userSelector;

        if (thisUser && method === 'delete') {
          // No need to do anything.
          return next();
        }

        const groupSelector = _.get(this.settings, 'group');
        const roleSelector = _.get(this.settings, 'role');
        const newGroups = this.getGroups(req.submission, groupSelector, roleSelector);
        const oldGroups = this.getGroups(req.previousSubmission, groupSelector, roleSelector);
        const groupsToRemove = _.difference(oldGroups, newGroups);
        const groupsToAdd = _.difference(newGroups, oldGroups);

        if (thisUser) {
          const userId = _.get(res, 'resource.item._id');
          return this.applyRoleChanges(userId, groupsToAdd, groupsToRemove, submissionModel)
            .then((roles) => {
              _.set(res, 'resource.item.roles', roles);
              resolve();
            }, reject);
        }

        const newUserId = this.getUserId(req.submission, userSelector);
        const oldUserId = this.getUserId(req.previousSubmission, userSelector);

        if (!oldUserId) {
          return this.applyRoleChanges(newUserId, newGroups, [], submissionModel).then(resolve, reject);
        }

        if (!newUserId) {
          return this.applyRoleChanges(oldUserId, [], oldGroups, submissionModel).then(resolve, reject);
        }

        if (newUserId === oldUserId) {
          return this.applyRoleChanges(newUserId, groupsToAdd, groupsToRemove, submissionModel).then(resolve, reject);
        }

        return Promise.all([
          this.applyRoleChanges(newUserId, newGroups, [], submissionModel),
          this.applyRoleChanges(oldUserId, [], oldGroups, submissionModel),
        ]).then(resolve, reject);
      })
        .then(() => next())
        .catch((err) => {
          const errorMessage = err
            ? err.message
              ? err.message
              : err
            : 'Unknown issue occured in group assignment action.';

          return res.status(400).send(errorMessage);
        });
    }
  }

  GroupAction.access = {
    handler: false,
    method: false,
  };

  return GroupAction;
};
