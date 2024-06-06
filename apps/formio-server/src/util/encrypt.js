'use strict';

const _ = require('lodash');
const eachSeries = require('async/eachSeries');
const util = require('./util');
const config = require('../../config');
const {Utils} = require('@formio/core/utils');

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

    loadProject: (req) => {
      return new Promise((resolve, reject) => {
        formioServer.formio.cache.loadCurrentProject(req, (err, project) => {
          if (err) {
            return reject(err);
          }

          resolve(project);
        });
      });
    },

    getValue: (project, operation, newValue, plan, prevValue) => {
      const decrypt = (operation === 'decrypt');
      if (decrypt && plan !== 'commercial') {
        return 'Encryption requires Enterprise Plan';
      }

      // #1. If we are encrypting, and the value was unable to be decrypted, then just leave the value as is.
      if (operation === 'encrypt' && newValue === '**COULD NOT DECRYPT**') {
        return;
      }

      // #2. If we are encrypting, and the value from the client is empty, we need to see if we can decrypt the previous value, and if we cannot decrypt, then leave the value as is.
      if (operation === 'encrypt' && newValue === '' && prevValue !== '') {
        try {
          if (!util.decrypt(project.settings.secret || config.formio.mongoSecret, prevValue)) {
            return;
          }
        }
        catch (err) {
          return;
        }
      }

      // If the value is already decrypted, then just return here.
      if (decrypt && (!newValue || (typeof data === 'string'))) {
        return newValue;
      }

      // Return the value.
      let result = '';
      try {
        result = util[operation](project.settings.secret || config.formio.mongoSecret, newValue);
        if (!result) {
          return decrypt ? '**COULD NOT DECRYPT**' : newValue;
        }
      }
      catch (err) {
        return decrypt ? '**COULD NOT DECRYPT**' : newValue;
      }

      // Return the decrypted value.
      return result;
    },

    encryptDecrypt: (req, submission, operation, next) => {
      Encryptor.loadProject(req).then((project) => {
        if (!req.currentForm && req.encryptedComponents) {
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
              _.get(submission.data, pathParts.join('.'), []).forEach((row) => {
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
        }
        else {
          Utils.eachComponentData(req.currentForm.components, submission.data, (component, data, row, path, components, index, parent) => {
            if (Encryptor.encryptedComponent(component)) {
              // Skip component if parent already encrypted.
              if (parent && Encryptor.containerBasedComponent(parent) && Encryptor.encryptedComponent(parent)) {
                return;
              }
              if (_.has(data, path)) {
                const prevValue = _.get(req.previousSubmission?.data, path);
                const newValue = _.get(data, path);
                const result = Encryptor.getValue(project, operation, newValue, req.primaryProject.plan, prevValue);
                if (result === undefined) {
                  return;
                }
                _.set(submission.data, path, result);
              }
            }
          });
        }

        next();
      }).catch((err)=>{
        console.warn(err.message);
        next();
      });
    },

    handle: (req, res, next) => {
      if (req.handlerName && _.get(req, 'licenseTerms.options.sac', false)) {
        if (Encryptor.encryptHandler(req.handlerName)) {
          Encryptor.encryptDecrypt(req, req.body, 'encrypt', next);
        }
        else if (Encryptor.decryptHandler(req.handlerName)) {
          if (res.resource && res.resource.item) {
            const items = (req.handlerName === 'afterIndex') ? res.resource.item : [res.resource.item];
            eachSeries(items, (submission, done) => Encryptor.encryptDecrypt(req, submission, 'decrypt', done), next);
          }
          else {
            return next();
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
