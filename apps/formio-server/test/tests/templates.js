/**/'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  let formio = app.formio.formio;
  let alters = hook.alter(`templateAlters`, {});
  let importer = formio.template;
  let testTemplate = require('./fixtures/template')();

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

  describe('Project Templates', function() {
    let project = {};
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
};