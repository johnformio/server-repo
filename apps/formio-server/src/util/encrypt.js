'use strict';

const keygenerator = require('keygenerator');
const _ = require('lodash');
const eachSeries = require('async/eachSeries');
const util = require('./util');

module.exports = (formioServer) => {
  const Encryptor = {
    encryptedComponent: (component) => {
      return component && component.encrypted && component.persistent;
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

    containerBasedComponent: (component) => {
      return Encryptor.arrayBasedComponent(component) || Encryptor.objectBasedComponent(component);
    },

    arrayBasedComponent: (component) => {
      return [
        'datagrid',
        'editgrid'
      ].indexOf(component.type) !== -1;
    },

    objectBasedComponent: (component) => {
      return [
        'container'
      ].indexOf(component.type) !== -1;
    },

    hasEncryptedComponents(req) {
      if (!req.encryptedComponents) {
        req.encryptedComponents = {};
        _.each(req.flattenedComponents, (component, path) => {
          if (Encryptor.encryptedComponent(component)) {
            req.encryptedComponents[path] = component;
          }
        });
      }

      return !_.isEmpty(req.encryptedComponents);
    },

    getProjectSecret: (req) => {
      return new Promise((resolve, reject) => {
        formioServer.formio.cache.loadCurrentProject(req, (err, project) => {
          if (err) {
            return reject(err);
          }

          if (project.settings.secret) {
            return resolve(project);
          }

          // Update project with randomly generated secret key.
          let secret = keygenerator._();
          project.settings = _.extend({}, project.settings, {
            secret: secret
          });
          project.save(); // Asynchronously save the project for performance reasons.
          return resolve(project);
        });
      });
    },

    getValue: (project, operation, data) => {
      let decrypt = (operation === 'decrypt');
      if (decrypt && project.plan !== 'commercial') {
        return 'Encryption requires Enterprise Plan';
      }

      // If the value is already decrypted, then just return here.
      if (decrypt && (!data || (typeof data === 'string'))) {
        return data;
      }

      // Return the value.
      let result = util[operation](project.settings.secret, data);
      if (!result) {
        return data;
      }

      // Return the decrypted value.
      return result;
    },

    encryptDecrypt: (req, submission, operation, next) => {
      Encryptor.getProjectSecret(req).then((project) => {
        _.each(req.encryptedComponents, (component, path) => {
          let parent = null;
          const pathParts = path.split('.');
          pathParts.pop();
          if (pathParts.length) {
            // Get the parent.
            parent = req.flattenedComponents[pathParts[(pathParts.length - 1)]];
          }

          // Skip component if parent already encrypted.
          if (parent && Encryptor.containerBasedComponent(parent) && Encryptor.encryptedComponent(parent)) {
            return;
          }

          // Handle array-based components.
          if (parent && Encryptor.arrayBasedComponent(parent)) {
            _.get(submission.data, pathParts.join('.')).forEach((row) => {
              row[component.key] = Encryptor.getValue(project, operation, row[component.key]);
            });
          }
          else if (_.has(submission.data, path)) {
            // Handle other components including Container, which is object-based.
            _.set(submission.data, path, Encryptor.getValue(project, operation, _.get(submission.data, path)));
          }
        });

        next();
      }).catch(next);
    },

    handle: (req, res, next) => {
      if (
        req.handlerName &&
        req.flattenedComponents &&
        Encryptor.hasEncryptedComponents(req)
      ) {
        if (Encryptor.encryptHandler(req.handlerName)) {
          Encryptor.encryptDecrypt(req, req.body, 'encrypt', next);
        }
        else if (Encryptor.decryptHandler(req.handlerName)) {
          if (res.resource && res.resource.item) {
            let items = (req.handlerName === 'afterIndex') ? res.resource.item : [res.resource.item];
            eachSeries(items, (submission, done) => Encryptor.encryptDecrypt(req, submission, 'decrypt', done), next);
          }
        }
        else {
          return next();
        }
      }
      else {
        return next();
      }
    }
  };

  return Encryptor;
};
