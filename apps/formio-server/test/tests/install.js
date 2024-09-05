/* eslint-env mocha */
'use strict';

// THIS FILE IS NOT BEING USED AS WE COULDN'T GET IT TO REQIURE CORRECTLY IN mocha.js //

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  var _template = {};
  var project = null;
  var forms = {};
  var token = null;

  describe('Install Tests', function() {
    before(function(done) {
      template.emptyDatabase(done);
    });

    it('creates three roles', function(done) {
      app.formio.mongoose.models.role.find()
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 3);
          _template.roles = {};
          results.forEach(function(role) {
            _template.roles[role.title] = role;
          });

          assert.equal(_template.roles.Administrator.machineName, 'formio:administrator');
          assert.equal(_template.roles.Authenticated.machineName, 'formio:authenticated');
          assert.equal(_template.roles.Anonymous.machineName, 'formio:anonymous');

          done();
        });
    });

    it('installs one project named formio', async function() {
      const results = await app.formio.resources.project.model.find({});
      assert.equal(results.length, 1);
      _template.project = results[0];
      _template.project.accessObject = {};
      _template.project.access.forEach(function(access) {
        _template.project.accessObject[access.type] = access.roles;
       });
        assert.equal(_template.project.name, 'formio');
        assert.equal(_template.project.machineName, 'formio');
        assert.equal(_template.project.accessObject.create_all.length, 1);
        assert.notEqual(_template.project.accessObject.create_all.indexOf(_template.roles.Administrator._id), -1);
        assert.equal(_template.project.accessObject.read_all.length, 2);
        assert.notEqual(_template.project.accessObject.read_all.indexOf(_template.roles.Administrator._id), -1);
        assert.notEqual(_template.project.accessObject.read_all.indexOf(_template.roles.Anonymous._id), -1);
        assert.equal(_template.project.accessObject.update_all.length, 1);
        assert.notEqual(_template.project.accessObject.update_all.indexOf(_template.roles.Administrator._id), -1);
        assert.equal(_template.project.accessObject.delete_all.length, 1);
        assert.notEqual(_template.project.accessObject.delete_all.indexOf(_template.roles.Administrator._id), -1);
    });

    it('Should put the roles in the project', function(done) {
      assert.equal(_template.roles.Administrator.project._id, _template.project._id._id);
      assert.equal(_template.roles.Authenticated.project._id, _template.project._id._id);
      assert.equal(_template.roles.Anonymous.project._id, _template.project._id._id);
      done();
    });

    it('creates one resource named user', async function() {
        const results = await app.formio.resources.form.model.find({
          type: 'resource'
        })
        .exec();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, 'user');
        _template.resources = {};
        _template.resources[results[0].name] = results[0];
        assert.equal(_template.resources.user.title, 'User');
        assert.equal(_template.resources.user.machineName, 'formio:user');
        assert.equal(_template.resources.user.project._id, _template.project._id._id);
        _template.resources.user.accessObject = {};
        _template.resources.user.access.forEach(function(access) {
          _template.resources.user.accessObject[access.type] = access.roles;
        });
        assert.equal(_template.project.accessObject.read_all.length, 2);
        assert.notEqual(_template.project.accessObject.read_all.indexOf(_template.roles.Administrator._id), -1);
        assert.notEqual(_template.project.accessObject.read_all.indexOf(_template.roles.Anonymous._id), -1);
    });

    it('creates one form named user login', async function() {
        const results = await app.formio.resources.form.model.find({
          type: 'form'
        })
        .exec();
        assert.equal(results.length, 1);
        assert.equal(results[0].name, 'userLogin');
        _template.forms = {};
        _template.forms[results[0].name] = results[0];
        assert.equal(_template.forms.userLogin.title, 'User Login');
        assert.equal(_template.forms.userLogin.machineName, 'formio:userLogin');
        assert.equal(_template.forms.userLogin.project._id, _template.project._id._id);
    });

    it('creates three actions', function(done) {
      app.formio.mongoose.models.action.find()
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 3);
          _template.actions = {};
          results.forEach(function(action) {
            _template.actions[action.name] = action;
          });

          assert.equal(_template.actions.save.title, 'Save Submission');
          assert.equal(_template.actions.save.machineName, 'formio:user:userSave');
          assert.equal(_template.actions.save.form._id, _template.resources.user._id._id);

          assert.equal(_template.actions.role.title, 'Role Assignment');
          assert.equal(_template.actions.role.machineName, 'formio:user:userRole');
          assert.equal(_template.actions.role.form._id, _template.resources.user._id._id);

          assert.equal(_template.actions.login.title, 'Login');
          assert.equal(_template.actions.login.machineName, 'formio:userLogin:userLoginLogin');
          assert.equal(_template.actions.login.form._id, _template.forms.userLogin._id._id);

          done();
        });
    });

    it('creates the administrative account', async function() {
          const results = await app.formio.resources.submission.model.find()
          .exec();
          assert.equal(results.length, 1);
          _template.owner = results[0];
          assert.equal(_template.owner.form._id, _template.resources.user._id._id);

          assert.equal(_template.owner.roles.length, 1);
          assert.notEqual(_template.owner.roles.indexOf(_template.roles.Administrator._id), -1);
    });

    it('assigns the admin to be the owner of the project', function(done) {
      assert.equal(_template.project.owner._id, _template.owner._id._id);
      done();
    });

    it('allows getting a list of primary projects', function(done) {
      request(app)
        .get('/')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var response = res.body;
          assert.equal(res.body.length, 1);
          project = res.body[0];
          assert.equal(project.name, 'formio');
          assert.equal(project.title, 'Formio');
          assert(project.alias);
          assert(project.url);
          assert(project.form);
          done();
        });
    });

    it('allows anonymous access to the list of forms in the primary project', function(done) {
      request(app)
        .get('/project/' + project._id + '/form')
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var response = res.body;
          assert.equal(response.length, 2);
          response.forEach(function(form) {
            forms[form.name] = form;
          });
          assert(forms.user);
          assert(forms.userLogin);
          done();
        });
    });

    it('allows logging in using the root account', function(done) {
      request(app)
        .post('/project/' + project._id + '/form/' + forms.userLogin._id + '/submission')
        .send({
          data: {
            'email': process.env.ADMIN_EMAIL,
            'password': process.env.ADMIN_PASS
          }
        })
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          token = res.headers['x-jwt-token'];
          done();
        });
    });

    after(function(done) {
      template.emptyDatabase(done);
    });
  });
};
