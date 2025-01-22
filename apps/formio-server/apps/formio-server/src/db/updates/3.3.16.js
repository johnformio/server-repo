'use strict';
const get = require('lodash/get');
const isString = require('lodash/isString');
const isArray = require('lodash/isArray');
const defaultTo = require('lodash/defaultTo');
const toNumber = require('lodash/toNumber');
const FormioUtils = require('@formio/js').Utils;

function getArrayFromComponentPath(pathStr) {
  if (!pathStr || !isString(pathStr)) {
    if (!isArray(pathStr)) {
      return [pathStr];
    }
    return pathStr;
  }
  return pathStr.replace(/[[\]]/g, '.')
    .replace(/\.\./g, '.')
    .replace(/(^\.)|(\.$)/g, '')
    .split('.')
    .map(part => defaultTo(toNumber(part), part));
}

/**
 * Update 3.3.16
 *
 * Update Date\Time values from string to ISODate format in all submissions
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
 module.exports = async function(db, config, tools, done) {
  // Perform in background.
  done();

  const eachRecord = async (collectionName, query, cb) => {
    const cursor = db.collection(collectionName).find(query);
    while (await cursor.hasNext()) {
      const record = await cursor.next();
      await cb(record);
    }
  };

  let shouldUpdate;

  const updateValue = (data, pathArr) => {
    const path = pathArr[0];

    if (isArray(data[path]) && data[path].length) {
      data[path].forEach(val => {
        updateValue(val, pathArr.slice(1));
      });
    } else if (data[path] && pathArr.length > 1) {
      updateValue(data[path], pathArr.slice(1));
    } else if (isString(data[path]) && !Number.isNaN(Date.parse(data[path]))) {
      data[path] = new Date(data[path]);
      if (!shouldUpdate) {
        shouldUpdate = true;
      }
    }
  };

  // Iterate through forms to find ones with "datetime" comps and update their submissions
  await eachRecord('forms', { deleted: { $eq: null } }, async (form) => {
    const formCompsToUpdate = [];
    // Get all "datetime" comps paths
    FormioUtils.eachComponent(form.components, (component, path) => {
      if (component.type === 'datetime') {
        formCompsToUpdate.push(path);
      }
    });

    if (formCompsToUpdate.length) {
      let submissionsCollectionName = 'submissions';

      if (get(form, 'settings.collection')) {
        const project = await db.collection('projects').findOne({ _id: form.project });

        if (project) {
          submissionsCollectionName = `${project.name.replace(/[^A-Za-z0-9]+/g, '')}_${form.settings.collection.replace(/[^A-Za-z0-9]+/g, '')}`;
        }
      }

      await eachRecord(submissionsCollectionName, { form: form._id, deleted: { $eq: null } }, async (submission) => {
        shouldUpdate = false;

        formCompsToUpdate.forEach((compPath) => {
          // If data for Date/Time component is saved in string format, convert it to Date and update the submission
          updateValue(submission.data, getArrayFromComponentPath(compPath));
        });

        if (shouldUpdate) {
          console.log('Updating Date/Time values in submission', submission._id.toString());
          await db.collection(submissionsCollectionName).updateOne({ _id: submission._id }, { $set: { data: submission.data } });
        }
      });
    }
  });

  console.log('Done!');
};
