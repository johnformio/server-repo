'use strict';
const _ = require('lodash');

/**
 * Update 3.3.14
 *
 * Implements Language Mode
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
    const actions = db.collection('actions');
    const roles = db.collection('roles');

    const setRoles = (roles) => {
        return roles.reduce((acc, role) => {
          if (role) {
            acc.push(role._id);
          }
          return acc;
        }, []);
      };

    const project = await projects.findOne({
        primary: true
    });

    if (!project) {
        console.log('No primary project found.');
        return;
    }

    // Get the anonymous role.
    const anonymousRole = await roles.findOne({
        project: project._id,
        default: true
    });

    // Get the authenticated role.
    const authenticatedRole = await roles.findOne({
        project: project._id,
        title: "Authenticated"
    });

    // Get the administrator role.
    const administratorRole = await roles.findOne({
        project: project._id,
        title: "Administrator"
    });

    const addLanguageResource = async function() {
        try {
            let languageResource = await forms.findOne({
                project: project._id,
                name: 'language'
            });

            if (languageResource) {
                const components = _.cloneDeep(languageResource.components);
                if (!components.some(({key}) => ['validate'].includes(key))) {
                  const updatedComponents = components.map((item) => {
                      if (item.key === 'language' || item.key === 'languageKey') {
                          return {...item, validate: {required: true}};
                      }
                      return item;
                  });

                  console.log('Updating language resource.');
                  await forms.updateOne(
                    {
                      _id: languageResource._id,
                    },
                    {
                      $set: {
                        components: updatedComponents,
                        access: [
                            {
                              roles: setRoles([administratorRole, authenticatedRole, anonymousRole]),
                              type: 'read_all',
                            }
                        ],
                        submissionAccess: [
                            {
                              roles: setRoles([administratorRole, authenticatedRole, anonymousRole]),
                              type: 'read_all',
                            }
                        ]
                      },
                    });
                }
                return;
            }

            console.log('Adding language resource.');

            await forms.insertOne({
                project: project._id,
                title: 'Language',
                type: 'resource',
                name: 'language',
                path: 'language',
                display: 'form',
                tags: [],
                deleted: null,
                owner: null,
                settings: {},
                components: [
                    {
                        "label" : "Language",
                        "tableView" : true,
                        "key" : "language",
                        "type" : "textfield",
                        "input" : true,
                        "unique": true,
                        "validate": {
                            "required": true
                        }
                    },
                    {
                        "label" : "Language key",
                        "tableView" : true,
                        "key" : "languageKey",
                        "type" : "textfield",
                        "input" : true,
                        "unique": true,
                        "validate": {
                            "required": true
                        }
                    },
                    {
                        "label" : "Translations",
                        "tableView" : false,
                        "key" : "translations",
                        "type" : "datamap",
                        "input" : true,
                        "valueComponent" : {
                            "label" : "Translation",
                            "tableView" : true,
                            "key" : "key",
                            "type" : "textfield",
                            "input" : true
                        }
                    },
                    {
                        "type" : "button",
                        "label" : "Submit",
                        "key" : "submit",
                        "disableOnInvalid" : true,
                        "input" : true,
                        "tableView" : false
                    }
                ],
                access: [
                    {
                      roles: setRoles([administratorRole, authenticatedRole, anonymousRole]),
                      type: 'read_all',
                    }
                ],
                submissionAccess: [
                    {
                      roles: setRoles([administratorRole, authenticatedRole, anonymousRole]),
                      type: 'read_all',
                    }
                ],
                "machineName" : "formio:language",
                "created": new Date(),
                "modified": new Date(),
                "__v": 0,
                "_vid": 1,
                "revisions": ""
            });
            languageResource = await forms.findOne({
                project: project._id,
                name: 'language'
            });
            await actions.insertOne({
                "handler" : [
                  "before"
                ],
                "method" : [
                  "create",
                  "update"
                ],
                "priority" : 10,
                "deleted" : null,
                "title" : "Save Submission",
                "name" : "save",
                "form" : languageResource._id,
                "machineName" : "formio:language:save",
                "__v" : 0
              });
        }
        catch (err) {
            console.log(err.message);
            return;
        }
    };

    await addLanguageResource();
    console.log('Done!');
};
