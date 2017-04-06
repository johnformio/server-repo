'use strict';

module.exports = function(db, config, tools, done) {
  let projects = db.collection('projects');

  /**
   * Create a promise for project creation index.
   *
   * @type {Promise}
   */
  let projectCreatedIndex = new Promise((resolve, reject) => {
    projects.createIndex({created: 1}, {background: true}, (err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });

  /**
   * Create a promise for project modification index.
   *
   * @type {Promise}
   */
  let projectModifiedIndex = new Promise((resolve, reject) => {
    projects.createIndex({modified: 1}, {background: true}, (err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });

  Promise.all([
    projectCreatedIndex,
    projectModifiedIndex
  ])
  .then(() => {
    return done();
  })
  .catch(done);
};
