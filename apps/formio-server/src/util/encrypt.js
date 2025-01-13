'use strict';

const _ = require('lodash');
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

    loadProject: async (req) => {
        const project = await formioServer.formio.cache.loadCurrentProject(req);
        return project;
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

    traverseComponents: (req, project, operation, components, data) => {
      Utils.eachComponentData(components, data, (component, data, row, path, components, index, parent) => {
        if (Encryptor.encryptedComponent(component)) {
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
            _.set(data, path, result);
          }
        }
      });
    },

    encryptDecrypt: async (req, submission, operation) => {
      try {
        const project = await formioServer.formio.cache.loadCurrentProject(req);
        if (!project) {
          throw new Error('Project not found');
        }
        const form = req.currentForm || formioServer.formio.cache.loadCurrentForm(req);
        await formioServer.formio.cache.loadSubForms(form, req);
        Encryptor.traverseComponents(req, project, operation, form.components, submission.data);
      }
      catch (err) {
        console.warn(err.message || err);
      }
    },

    handle: async (req, res) => {
      if (req.handlerName && _.get(req, 'licenseTerms.options.sac', false)) {
        if (Encryptor.encryptHandler(req.handlerName)) {
          await Encryptor.encryptDecrypt(req, req.body, 'encrypt');
        }
        else if (Encryptor.decryptHandler(req.handlerName)) {
          if (res.resource && res.resource.item) {
            const submissions = (req.handlerName === 'afterIndex') ? res.resource.item : [res.resource.item];
            for (const submission of submissions) {
              await Encryptor.encryptDecrypt(req, submission, 'decrypt');
            }
          }
        }
      }
    }
  };

  return Encryptor;
};
