'use strict';
const _ = require('lodash');

/**
 * Update 3.3.19
 *
 * Add character limit for email when adding a user to a team
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
 module.exports = async function(db, config, tools, done) {
    // Perform in background.
    done();

    const projects = db.collection('projects');
    const forms = db.collection('forms');

    const project = await projects.findOne({
      primary: true
    });

    if (!project) {
      console.log('No primary project found for updating teams.');
      return;
    }

    forms.updateOne({
        project: project._id,
        name: 'member',
        'components.key': 'email'
      },
      {
      $set: {
          'components.$.maxLength' : 254
        }
    });
};