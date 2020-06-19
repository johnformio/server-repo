/**/'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();
let formioUtils = require('formiojs/utils').default;

module.exports = function(app, template, hook) {
  let formio = app.formio.formio;
  let alters = hook.alter(`templateAlters`, {});
  let importer = formio.template;

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

        let machineName = form.machineName;
        let tempForm = _.omit(form, ['_id', '__v', 'created', 'deleted', 'modified', 'machineName', 'owner', '_vid', 'revisions']);

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
        assert.deepEqual(_.omit(exportData, ['version', 'tag', 'access']), _.omit(testTemplate, ['version', 'tag', 'access']));
      });
    });

    before(function(done) {
      template.clearData(done);
    });

    after(function(done) {
      template.clearData(done);
    });
  });
};
