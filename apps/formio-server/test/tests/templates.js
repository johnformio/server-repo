/**/'use strict';

const request = require('supertest');
const assert = require('assert');
const _ = require('lodash');
const config = require('../../config');
const mockBroswerContext = require('@formio/vm/build/mockBrowserContext');
mockBroswerContext.default();
const formioUtils = require('@formio/js').Utils;

module.exports = function(app, template, hook) {
  let formio = app.formio.formio;
  let alters = hook.alter(`templateAlters`, {});
  let importer = formio.template;

  const getRoleNameFromId = (roles, id) => {
    // TODO: risky, what if title gets changed; find API that returns key-value of role so you can key into key name
    const result = roles.find((role) => role._id === id)['title'];
    return result ? result.toLowerCase() : undefined;
  };

  const mapRoleIdsToRoleNames = ({type, roles: accessRoles}, roles) => {
    return {type: type.toLowerCase(), roles: accessRoles.map((id) => getRoleNameFromId(roles, id)).sort()};
  }

  let getResourceFromId = (project, id) => {
    project = project || {};
    project.forms = project.forms || {};
    project.resources = project.resources || {};

    let resourceName;
    if (project.forms[id]) {
      resourceName = project.forms[id].machineName;
    }
    else if (project.resources[id]) {
      resourceName = project.resources[id].machineName;
    }
    else if (project.roles[id]) {
      resourceName = project.roles[id].machineName
    }

    return resourceName;
  };

  let checkTemplateRoles = (project, input, done) => {
    input = input || {};

    formio.resources.role.model.find(
      {
        project: project._id,
        deleted: {$eq: null}
      }
    ).then(roles => {
      assert.equal(roles.length, Object.keys(input).length);

      // If the input is empty, skip remaining checks.
      if (Object.keys(input).length === 0) {
        return done();
      }

      // Check that the template data doesnt contain any _id's or machineNames
      Object.keys(input).forEach(machineName => {
        let role = input[machineName];

        assert.equal(role.hasOwnProperty('_id'), false);
        assert.equal(role.hasOwnProperty('machineName'), false);
      });

      let given = {};

      // Memoize the roles.
      project.roles = {};
      roles.forEach(role => {
        role = role.toObject();

        // Check that each role in mongo has an _id and a machineName.
        assert.equal(role.hasOwnProperty('_id'), true);
        assert.equal(role.hasOwnProperty('machineName'), true);

        // Prepare the stored roles for comparison.
        let machineName = role.machineName;
        given[machineName] = _.omit(role, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName']);

        project.roles[machineName] = project.roles[role._id] = role;
      });

      assert.deepEqual(hook.alter('templateRoles', given), input);
      done();
    })
    .catch(done);
  };

  let checkTemplateFormsAndResources = (project, type, input, done) => {
    input = input || {};

    formio.resources.form.model.find({type, deleted: {$eq: null}}).then(forms => {
      assert.equal(forms.length, Object.keys(input).length);

      if (Object.keys(input).length === 0) {
        return done()
      }

      // Check that the template data doesnt contain any _id's or machineNames
      Object.keys(input).forEach(machineName => {
        let form = input[machineName];

        assert.equal(form.hasOwnProperty('_id'), false);
        assert.equal(form.hasOwnProperty('machineName'), false);
      });

      let given = {};

      // Memoize the forms.
      project[`${type}s`] = {};
      forms.forEach(form => {
        form = form.toObject();

        // Check that each form in mongo has an _id and machineName.
        assert.equal(form.hasOwnProperty('_id'), true);
        assert.equal(form.hasOwnProperty('machineName'), true);

        if (form.hasOwnProperty('revisions') && !form.revisions) {
          assert.equal(form._vid, 0);
        }

        let machineName = form.machineName;
        let tempForm = _.omit(form, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName', 'owner', '_vid']);

        tempForm.access = tempForm.access.map(access => {
          access.roles = access.roles.map(role => {
            return project.roles[role.toString()].machineName;
          });

          return access;
        });

        tempForm.submissionAccess = tempForm.submissionAccess.map(access => {
          access.roles = access.roles.map(role => {
            return project.roles[role.toString()].machineName;
          });

          return access;
        });
        given[machineName] = tempForm;

        project[`${type}s`][form.machineName] = project[`${type}s`][form._id] = form;
      });

      // Reassign the resources after the forms have been memoized.
      Object.keys(given).forEach(machineName => {
        let tempForm = given[machineName];
        // Convert all resources to point to the resource name;
        formioUtils.eachComponent(tempForm.components, (component) => {
          hook.alter('exportComponent', component);
          if (component.hasOwnProperty('resource') && project.resources && project.resources.hasOwnProperty(component.resource)) {
            component.resource = project.resources[component.resource].name;
          }
        }, true);
        given[machineName] = tempForm;
      });

      assert.deepEqual(hook.alter('templateFormsAndResources', given), input);
      done();
    })
    .catch(done);
  };

  let checkTemplateActions = (project, input, done) => {
    input = input || {};

    formio.actions.model.find({deleted: {$eq: null}}).then(actions => {
      assert.equal(actions.length, Object.keys(input).length);

      if (Object.keys(input).length === 0) {
        return done()
      }

      // Check that the template data doesnt contain any _id's or machineNames
      Object.keys(input).forEach(machineName => {
        let action = input[machineName];

        assert.equal(action.hasOwnProperty('_id'), false);
        assert.equal(action.hasOwnProperty('machineName'), false);
      });

      let given = {};

      // Memoize the forms.
      project.actions = {};
      actions.forEach(action => {
        action = action.toObject();

        // Check that each action in mongo has an _id and machineName.
        assert.equal(action.hasOwnProperty('_id'), true);
        assert.equal(action.hasOwnProperty('machineName'), true);

        // Prepare the stored actions for comparison.
        let machineName = action.machineName;
        let tempAction = _.omit(action, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName']);
        tempAction.form = getResourceFromId(project, tempAction.form);
        if (_.has(tempAction, 'settings.resource')) {
          tempAction.settings.resource = getResourceFromId(project, tempAction.settings.resource);
        }
        if (_.has(tempAction, 'settings.resources')) {
          tempAction.settings.resources = tempAction.settings.resources.map(resource => {
            return getResourceFromId(project, resource);
          });
        }
        if (_.has(tempAction, 'settings.role')) {
          tempAction.settings.role = project.roles[tempAction.settings.role].machineName;
        }
        given[machineName] = tempAction;

        project.actions[machineName] = project.actions[action._id] = action;
      });

      assert.deepEqual(hook.alter('templateActions', given), input);
      done();
    })
    .catch(done);
  };

  describe('Project Templates', function() {
    let project = {};
    let testTemplate = require('./fixtures/template')();
    const _template = _.cloneDeep(testTemplate);

    it('Imports a project', function(done) {
      importer.import.template(_template, alters, (err, result) => {
        if (err) {
          return done(err);
        }
        project = result;

        done();
      });
    });

    it('Imports all the roles', function(done) {
      checkTemplateRoles(project, testTemplate.roles, done);
    });

    it('Imports the project access correctly', function(done) {
      formio.resources.project.model.findOne({
        _id: project._id,
        deleted: {$eq: null}
      })
        .then((_project) => {
          let templateAccesses = {};
          let projectAccesses = {};
          testTemplate.access.forEach(access => {
            templateAccesses[access.type] = access.roles.map(roleName => project.roles[_project.machineName + ':' + roleName]._id.toString());
          });
          _project.access.forEach(access => {
            projectAccesses[access.type] = access.roles.map(_id => _id.toString());
          });
          assert.deepEqual(templateAccesses, projectAccesses);

          return done();
        })
        .catch(done);
    });

    it('Exports the project access correctly', function(done) {
      let exportData = {};
      formio.resources.project.model.findOne({
          _id: project._id,
          deleted: {$eq: null}
        })
        .then((_project) => {
          let options = {
            _id: _project._id,
            access: _project.access
          };

          importer.export(options, (err, data) => {
            if (err) {
              return done(err);
            }

            exportData = data;

            assert.deepEqual(testTemplate.access, data.access);

            done();
          });

        });
    });

    describe('Projects with orphaned revisions', function() {
      let project = {
        framework: "custom",
        title: "Brendan's Happy Time Fun Land",
        stageTitle: "Live",
        type: "project",
        settings: {
            cors: "*"
        }
      };
      let formWithRevisionsDisabled, formWithNestedFormAndOrphanedRevision;
      before(() => {
        process.env.ADMIN_KEY = 'examplekey';
      });

      it('Should create the project', (done) => {
        request(app)
          .post('/project')
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send(project)
          .expect(201)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert(res.body.hasOwnProperty('access'), 'Created project should have access property');
            assert(res.body.hasOwnProperty('created'), 'Created project should have created at property');
            assert(res.body.hasOwnProperty('type'), 'Created project should have type property');
            assert.equal(res.body.type, 'project');
            project = res.body;

            done();
          });
      });

      it('Should create a form with revisions disabled', (done) => {
        request(app)
          .post(`/project/${project._id}/form`)
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send({
            "title": "Form With Revisions Disabled",
            "type": "form",
            "name": "formWithRevisionsDisabled",
            "path": "formWithRevisionsDisabled",
            "display": "form",
            "tags": [],
            "settings": {},
            "components": [
              {
                "label": "Name",
                "tableView": true,
                "key": "name",
                "type": "textfield",
                "input": true
              },
              {
                "type": "button",
                "label": "Submit",
                "key": "submit",
                "disableOnInvalid": true,
                "input": true,
                "tableView": false
              }
            ],
            "properties": {},
            "controller": "",
            "submissionRevisions": "",
            "revisions": ""
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert(res.body.hasOwnProperty('_id'), 'Created form should have _id property');
            assert(res.body.hasOwnProperty('type'), 'Created form should have type property');
            assert.equal(res.body.type, 'form');
            formWithRevisionsDisabled = res.body;

            done();
          });
      });

      it('Should create a form pointing at a form with revisions disabled but include an orphaned revision in its nested component', (done) => {
        request(app)
          .post(`/project/${project._id}/form`)
          .set('x-admin-key', process.env.ADMIN_KEY)
          .send({
            "title": "Form With Nested Form and Revision",
            "type": "form",
            "name": "formWithNestedFormAndRevision",
            "path": "formWithNestedFormAndRevision",
            "display": "form",
            "tags": [],
            "settings": {},
            "components": [
              {
                "label": "Nested Form",
                "tableView": true,
                "form": formWithRevisionsDisabled._id,
                "revision": "1",
                "useOriginalRevision": false,
                "key": "nestedForm",
                "type": "form",
                "input": true
              },
              {
                "type": "button",
                "label": "Submit",
                "key": "submit",
                "disableOnInvalid": true,
                "input": true,
                "tableView": false
              }
            ],
            "properties": {},
            "controller": "",
            "submissionRevisions": ""
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert(res.body.hasOwnProperty('_id'), 'Created form should have _id property');
            assert(res.body.hasOwnProperty('type'), 'Created form should have type property');
            assert.equal(res.body.type, 'form');
            formWithNestedFormAndOrphanedRevision = res.body;

            done();
          });
      });

      it('Should export the project correctly', (done) => {
        request(app)
          .get(`/project/${project._id}/export`)
          .set('x-admin-key', process.env.ADMIN_KEY)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert.equal(res.body.title, "Brendan's Happy Time Fun Land");
            assert(res.body.hasOwnProperty('forms'), 'The created template has forms');
            assert(res.body.hasOwnProperty('resources'), 'The created template has resources');
            assert(res.body.forms.hasOwnProperty('formWithRevisionsDisabled'), 'The created template includes the first form');
            assert(res.body.forms.hasOwnProperty('formWithNestedFormAndRevision'), 'The created template includes the second form');
            done();
          });
      })
    });
  });

  describe('formAndResourceWithController Template', function() {
    let testTemplate = require('./fixtures/formAndResourceWithController.json');
    let _template = _.cloneDeep(testTemplate);

    describe('Import', function() {
      let project = {title: 'Export', name: 'export'};

      it('Should be able to bootstrap the template', function(done) {
        importer.import.template(_template, alters, (err, template) => {
          if (err) {
            return done(err);
          }

          done();
        });
      });

      it('All the forms should be imported', function(done) {
        hook.alter('templateImportComponent', testTemplate.forms);
        checkTemplateFormsAndResources(project, 'form', testTemplate.forms, done);
      });

      it('All the resources should be imported', function(done) {
        hook.alter('templateImportComponent', testTemplate.resources);
        checkTemplateFormsAndResources(project, 'resource', testTemplate.resources, done);
      });
    });

    describe('Export', function() {
      let project = {};
      let exportData = {};

      it('Should be able to export project data', function(done) {
        importer.export(_template, (err, data) => {
          if (err) {
            return done(err);
          }

          exportData = data;
          return done();
        });
      });

      it('An export should contain the export title', function() {
        assert.equal(
          hook.alter('exportTitle', 'Export', exportData),
          'Export'
        );
      });

      it('An export should contain the current export version', function() {
        assert.equal(
          exportData.version,
          '2.0.0'
        );
      });

      it('An export should contain the description', function() {
        assert.equal(
          hook.alter('exportDescription', '', exportData),
          ''
        );
      });

      it('An export should contain the export name', function() {
        assert.equal(
          hook.alter('exportName', 'export', exportData),
          'export'
        );
      });

      it('An export should contain the export plan', function() {
        assert.equal(
          hook.alter('exportPlan', 'community', exportData),
          'community'
        );
      });

      it('The template should export all its roles', function(done) {
        checkTemplateRoles(project, exportData.roles, done);
      });

      it('The template should export all of its forms', function(done) {
        assert.notDeepEqual(exportData.forms, {});
        checkTemplateFormsAndResources(project, 'form', exportData.forms, done);
      });

      it('The template should export all of its resources', function(done) {
        checkTemplateFormsAndResources(project, 'resource', exportData.resources, done);
      });

      it('The template should export all of its actions', function(done) {
        hook.alter('templateActionExport', exportData.actions);
        checkTemplateActions(project, exportData.actions, done);
      });

      it('An export should match an import', function() {
        assert.equal(exportData.version, '2.0.0');
        const expectedTemplateResult = _.omit(testTemplate, ['version', 'tag', 'access']);
        if (app.formio.formio.hook.alter('includeReports')) {
          expectedTemplateResult.reports = {};
        }
        assert.deepEqual(_.omit(exportData, ['version', 'tag', 'access']), expectedTemplateResult);
      });
    });

    before(function(done) {
      template.clearData(done);
    });

    after(function(done) {
      template.clearData(done);
    });
  });

  describe('Revisions Block Template', function() {
    let testTemplate = require('./fixtures/revisionsData.json');
    let _template = _.cloneDeep(testTemplate);
    let revisionId = testTemplate.forms.outer.components[0].revision;
    let project;

    describe('Import', function() {

    it('Should be able to bootstrap the template', function(done) {
      importer.import.template(_template, alters, (err, data) => {
        if (err) {
          return done(err);
        }
        project = data;
        done();
      });
    });

    it('All the forms should be imported', function(done) {
      assert.deepEqual(_.omit(project.forms.inner, ['_id', 'created', 'modified', '__v', 'owner', 'machineName', 'submissionAccess', 'deleted', 'access', '_vid', 'project', 'revisions', 'submissionRevisions', 'esign']),
      _.omit(testTemplate.forms.inner, ['revisions', 'esign']));
      assert.deepEqual(_.omit(project.forms.outer, ['_id', 'created', 'modified', '__v', 'owner', 'machineName', 'submissionAccess', 'deleted', 'access', 'components', '_vid', 'project', 'revisions', 'submissionRevisions', 'esign']),
      _.omit(testTemplate.forms.outer, ['revisions', 'components', 'esign']));
      assert.deepEqual(_.omit(project.forms.outer.components[0], ['form']),
      _.omit(testTemplate.forms.outer.components[0], ['form']));
      assert.deepEqual(project.forms.outer.components[1], testTemplate.forms.outer.components[1]);
     done();
    });
    });

    describe('Export', function() {
      let exportData = {};

      it('Should be able to export project data', function(done) {
        importer.export(project, (err, data) => {
          if (err) {
            return done(err);
          }

          exportData = data;
          exportData.forms = _.mapValues(exportData.forms, (form) => _.omit(form, ['submissionRevisions']));
          exportData.resources = _.mapValues(exportData.resources, (resource) => _.omit(resource, ['submissionRevisions']));
          return done();
        });
      })

      it('An import/export should not change revisionId of nested form', function(done) {
        assert.equal(exportData.forms.outer.components[0].revision, revisionId);
        _.forEach(project.revisions, (revisionData, revisionKey) => {
          if (revisionKey.match(`^inner:`)) {
            assert.equal(revisionData.revisionId, revisionId);
          }
        });
        done();
      }); 
    });

    before(function(done) {
      template.clearData(done);
    });

    after(function(done) {
      template.clearData(done);
    });
  });

  describe('Project templates that exclude access', function() {
    let templateThatExcludesAccessJSON = require('./fixtures/excludeAccessTemplate.json');
    let templateThatExcludesAccess = _.cloneDeep(templateThatExcludesAccessJSON);
    let project;
    let roles;

    before(() => {
      process.env.ADMIN_KEY = 'examplekey';
    });

    it('Should create the project from template', (done) => {
      request(app)
        .post('/project')
        .set('x-admin-key', process.env.ADMIN_KEY)
        .send(templateThatExcludesAccess)
        .expect(201)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            done(err);
          }
          assert(res.body.hasOwnProperty('access'), 'Created project should have access property');
          assert(res.body.hasOwnProperty('created'), 'Created project should have created at property');
          assert(res.body.hasOwnProperty('type'), 'Created project should have type property');
          assert.equal(res.body.type, 'project');
          project = res.body;

          done();
        });
    });

    it('Should grant default project level access', (done) => {
      const defaultTemplateJSON = formio.templates['default'];
      const defaultProjectAccess = _.cloneDeep(defaultTemplateJSON.access);
      assert(defaultProjectAccess, 'Default template should exist');

      request(app)
        .get(`/project/${project._id}`)
        .set('x-admin-key', process.env.ADMIN_KEY)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            done(err);
          }
          project = res.body;
          // get the roles
          request(app)
            .get(`/project/${project._id}/role`)
            .set('x-admin-key', process.env.ADMIN_KEY)
            .expect(200)
            .expect('Content-Type', /json/)
            .end((err, res) => {
              if (err) {
                done(err);
              }
              roles = res.body;
              const mappedProjectAccess = project.access.map((access) => mapRoleIdsToRoleNames(access, roles));
              assert.deepEqual(mappedProjectAccess, defaultProjectAccess);
              done();
            });
        })
    });

    it('Should grant default form level access and submission access to forms whose names match the default template', (done) => {
      const defaultTemplateJSON = formio.templates['default'];
      const defaultForms = _.cloneDeep(defaultTemplateJSON.forms);
      assert(defaultForms, 'Default template should exist');
      assert.equal(typeof defaultForms, 'object');

      request(app)
        .get(`/project/${project._id}/form`)
        .set('x-admin-key', process.env.ADMIN_KEY)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            done(err);
          }

          const forms = res.body;
          Object.entries(defaultForms).forEach(([defaultFormKey, defaultForm]) => {
            const matchingProjectForm = forms.find((form) => form.name === defaultFormKey);
            if (matchingProjectForm) {
              const mappedFormAccess = matchingProjectForm.access.map((access) => mapRoleIdsToRoleNames(access, roles));
              const mappedFormSubmissionAccess = matchingProjectForm.submissionAccess.map((access) => mapRoleIdsToRoleNames(access, roles));
              assert.deepEqual(mappedFormAccess, defaultForm.access);
              assert.deepEqual(mappedFormSubmissionAccess, defaultForm.submissionAccess);
            }
          });
          done();
        });
    });

    it('Should grant default form level access and submission access to forms whose names are not included in the default template', (done) => {
      const defaultTemplateJSON = formio.templates['default'];
      const defaultForms = _.cloneDeep(defaultTemplateJSON.forms);
      const defaultResources = _.cloneDeep(defaultTemplateJSON.resources);
      const templateRoles = _.cloneDeep(templateThatExcludesAccess.roles);
      const defaultFormAccess = [{type: 'read_all', roles: Object.keys(templateRoles).sort()}];
      const defaultSubmissionAccess = [];
      assert(defaultForms, 'Default template should exist');
      assert.equal(typeof defaultForms, 'object');

      request(app)
        .get(`/project/${project._id}/form`)
        .set('x-admin-key', process.env.ADMIN_KEY)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            done(err);
          }

          const forms = res.body.filter((item) => item.type === 'form');
          const resources = res.body.filter((item) => item.type === 'resource');
          forms.forEach((form) => {
            const matchingProjectForm = defaultForms[form.name];
            const mappedFormAccess = form.access.map((access) => mapRoleIdsToRoleNames(access, roles));
            const mappedFormSubmissionAccess = form.submissionAccess.map((access) => mapRoleIdsToRoleNames(access, roles));
            if (!matchingProjectForm) {
              assert.deepEqual(mappedFormAccess, defaultFormAccess, `1 Error in form ${form.path}`);
              assert.deepEqual(mappedFormSubmissionAccess, defaultSubmissionAccess, `2 Error in form ${form.path}`);
            }
          });
          resources.forEach((resource) => {
            const matchingProjectForm = defaultResources[resource.name];
            const mappedFormAccess = resource.access.map((access) => mapRoleIdsToRoleNames(access, roles));
            const mappedFormSubmissionAccess = resource.submissionAccess.map((access) => mapRoleIdsToRoleNames(access, roles));
            if (!matchingProjectForm) {
              assert.deepEqual(mappedFormAccess, defaultFormAccess, `1 Error in resource ${resource.path}`);
              assert.deepEqual(mappedFormSubmissionAccess, defaultSubmissionAccess, `2 Error in resource ${resource.path}`);
            }
          });
          done();
        });
    });
  });
};
