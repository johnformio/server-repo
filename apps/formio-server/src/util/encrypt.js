'use strict';

const keygenerator = require('keygenerator');
const _ = require('lodash');
const util = require('./util');

module.exports = (formioServer) => {
  const Encryptor = {
    encryptedComponent: (component) => {
      return component && component.encrypted && component.persistent;
    },

    encryptDecryptHandler: (handlerName) => {
      return Encryptor.encryptHandler(handlerName) || Encryptor.decryptHandler(handlerName);
    },

    encryptHandler: (handlerName) => {
      return [
        'beforePost',
        'beforePut'
      ].indexOf(handlerName) !== -1;
    },

    decryptHandler: (handlerName) => {
      return [
        'afterGet',
        'afterIndex',
        'afterPost',
        'afterPut'
      ].indexOf(handlerName) !== -1;
    },

    containerBasedComponent: (componentType) => {
      return Encryptor.arrayBasedComponent(componentType) || Encryptor.objectBasedComponent(componentType);
    },

    arrayBasedComponent: (componentType) => {
      return [
        'datagrid',
        'editgrid'
      ].indexOf(componentType) !== -1;
    },

    objectBasedComponent: (componentType) => {
      return [
        'container'
      ].indexOf(componentType) !== -1;
    },

    getParentPath: (path) => {
      return path.substr(0, path.lastIndexOf('.'));
    },

    handle: (req, res, next) => {
      if (
        req.handlerName &&
        Encryptor.encryptDecryptHandler(req.handlerName) &&
        req.currentProject &&
        req.currentProject.settings &&
        req.flattenedComponents
      ) {
        let {secret} = req.currentProject.settings;
        let secretSet = Promise.resolve();

        if (!secret) {
          // Update project with randomly generated secret key.
          secret = keygenerator._();
          secretSet = formioServer.formio.resources.project.model.findById(req.projectId)
            .exec()
            .then((project) => {
              project.settings = _.extend({}, project.settings, {
                secret: secret
              });
              return project.save();
            });
        }

        return secretSet.then(() => {
          let encryptedComponents = [];
          _.each(req.flattenedComponents, (component, path) => {
            if (Encryptor.encryptedComponent(component)) {
              encryptedComponents.push(component);
            }
          });

          if (!encryptedComponents.length) {
            return next();
          }

          if (Encryptor.encryptHandler(req.handlerName)) {
            _.each(encryptedComponents, (component, path) => {
              const parentType = _.get(component, 'parent.type');

              // Skip component if parent already encrypted.
              if (Encryptor.containerBasedComponent(parentType) && Encryptor.encryptedComponent(component.parent)) {
                return;
              }

              // Handle array-based components.
              if (Encryptor.arrayBasedComponent(parentType)) {
                _.get(req.body.data, Encryptor.getParentPath(path)).forEach((row) => {
                  row[component.key] = util.encrypt(secret, row[component.key]);
                });
              }
              else if (_.has(req.body.data, path)) {
                // Handle other components including Container, which is object-based.
                _.set(req.body.data, path, util.encrypt(secret, _.get(req.body.data, path)));
              }
            });
          }
          else {
            let items = (req.handlerName === 'afterIndex') ? res.resource.item : [res.resource.item];
            _.each(items, (submission, index) => {
              _.each(encryptedComponents, (component, path) => {
                const parentType = _.get(component, 'parent.type');

                // Skip component if parent already decrypted.
                if (Encryptor.containerBasedComponent(parentType) && Encryptor.encryptedComponent(component.parent)) {
                  return;
                }

                // Handle array-based components.
                if (Encryptor.arrayBasedComponent(parentType)) {
                  _.get(submission.data, Encryptor.getParentPath(path)).forEach((row) => {
                    row[component.key] = util.decrypt(secret, row[component.key]);
                  });
                }
                else if (_.get(submission.data, path)) {
                  // Handle other components including Container, which is object-based.
                  _.set(submission.data, path, util.decrypt(secret, _.get(submission.data, path)));
                }
              });
            });
          }

          return next();
        });
      }
      else {
        return next();
      }
    }
  };

  return Encryptor;
};
