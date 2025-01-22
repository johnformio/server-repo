'use strict';
const mongodb = require('mongodb');

/**
 * Update 3.3.19
 *
 * Update form revisions to use revisionId instead of _id
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = async function (db, config, tools, done) {
  // Perform in background.
  done();

  const formRevisions = await db.collection('formrevisions');

  formRevisions.find({ deleted: { $eq: null } }).forEach(revision => {
    if (!revision.revisionId) {
      formRevisions.updateOne({ _id: revision._id }, { $set: { revisionId: revision._id } });
    }
  }, (err) => {
    if (err) {
      console.log(err.message);
    }

    console.log('Done!');
  });
};
