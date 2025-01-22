const debug = require('debug')('formio:db');

/**
 * Update 3.3.18
 *
 * The change to remove `partialFilterExpression` indexes from the `Form` and `Submission` mongoose
 * models (https://github.com/formio/formio/commit/b316f30f8989f92671de306a610790046c52057f) and to add collation-aware
 * indexes to the `Submission` mongoose model
 * (https://github.com/formio/formio-server/blob/262e01e39e35db105d6f932df4e1dd114c691145/src/hooks/alter/models.js#L93)
 * can cause users that both upgrade from 7.x AND use custom submission collections to run into index creation errors;
 * this is due to the index has already been successfully created in the 7.x. environment and you can't
 * create an index that already exists with different options. This update synchronizes those particular
 * indexes in the form collection and any custom submission collections so upgrading customers will no longer
 * run into problems
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = async function(db, config, tools, done) {
  done();
  try {
    const EXCLUDED_COLLECTIONS = [
      'actionitems',
      'actions',
      'formrevisions',
      'projects',
      'roles',
      'schema',
      'sessions',
      'submissionrevisions',
      'tags',
      'tokens',
      'usage',
    ];
    let collections = await db.listCollections().toArray();

    for (const collection of collections) {
      const { name: collectionName } = collection;

      if (EXCLUDED_COLLECTIONS.includes(collectionName)) continue;

      // Check if an index with `partialFilterExpression` exists on the forms collection, submissions collection, and
      // custom submissions collections for the `deleted` field; if so, drop it and create a vanilla one
      let indexes = await db
        .collection(collectionName)
        .indexInformation({ full: true });
      for (const index of indexes) {
        if (index.name === 'deleted_1' && index.partialFilterExpression) {
          debug(`Dropping partialFilterExpress index 'deleted_1' from collection ${collectionName}`);
          await db.collection(collectionName).dropIndex('deleted_1');
          debug(`Creating vanilla index 'deleted_1' for collection ${collectionName}`);
          await db.collection(collectionName).createIndex(
            { deleted: 1 },
            { background: true }
          );
        }
        if (
          index.key.hasOwnProperty("deleted") &&
          index.key.hasOwnProperty("project") &&
          index.key.hasOwnProperty("form") &&
          index.key.hasOwnProperty("data.email") &&
          config.mongoFeatures.collation &&
          !index.collation
        ) {
          debug(`Dropping vanilla index ${index.name} from collection ${collectionName}`);
          await db.collection(collectionName).dropIndex(index.name);
          debug(`Creating collation-aware index for collection ${collectionName}`);
          await db.collection(collectionName).createIndex(
            { form: 1, project: 1, 'data.email': 1, deleted: 1 },
            { background: true, collation: { locale: 'en', strength: 2 } }
          );
        }
      }
    }
  }
  catch (err) {
    debug('Error during schema update 3.3.18:', err.message || err);
  }
}
