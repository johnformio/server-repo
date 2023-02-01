'use strict';

const keygenerator = require('keygenerator');
const _ = require('lodash');
const eachSeries = require('async/eachSeries');
const util = require('./util');

module.exports = (formioServer) => {
  const Encryptor = {
    encryptedComponent: (component) => {
      const isPersistent = !component.hasOwnProperty('persistent') || component.persistent;
      return component && component.encrypted && isPersistent;
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

          if (_.get(project, 'settings.secret', '')) {
            return resolve(project);
          }

          // Update the request cached item.
          _.set(project, 'settings.secret', keygenerator._());

          // Create a secret key.
          formioServer.formio.cache.updateCurrentProject(req, {
            settings: {
              secret: project.settings.secret
            }
          }, (err, project) => {
            if (err) {
              return reject(err);
            }
            return resolve(project);
          });
        });
      });
    },

    getValue: (project, operation, data, plan) => {
      const decrypt = (operation === 'decrypt');
      if (decrypt && plan !== 'commercial') {
        return 'Encryption requires Enterprise Plan';
      }

      // If the value is already decrypted, then just return here.
      if (decrypt && (!data || (typeof data === 'string'))) {
        return data;
      }

      // Return the value.
      const result = util[operation](project.settings.secret, data);
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
              row[component.key] = Encryptor.getValue(project, operation, row[component.key], req.primaryProject ? req.primaryProject.plan : '');
            });
          }
          else if (_.has(submission.data, path)) {
            // Handle other components including Container, which is object-based.
            _.set(
              submission.data,
              path,
              Encryptor.getValue(
                project,
                operation,
                _.get(submission.data, path),
                req.primaryProject.plan
              )
            );
          }
        });

        next();
      }).catch(next);
    },

    handle: (req, res, next) => {
      if (
        req.handlerName &&
        req.flattenedComponents &&
        Encryptor.hasEncryptedComponents(req) &&
        _.get(req, 'licenseTerms.options.sac', false)
      ) {
        if (Encryptor.encryptHandler(req.handlerName)) {
          Encryptor.encryptDecrypt(req, req.body, 'encrypt', next);
        }
        else if (Encryptor.decryptHandler(req.handlerName)) {
          if (res.resource && res.resource.item) {
            const items = (req.handlerName === 'afterIndex') ? res.resource.item : [res.resource.item];
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
