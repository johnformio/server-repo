/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  var template = {};
  var project = null;
  var forms = {};
  var token = null;

  describe('Install Tests', function() {

    it('creates three roles', function(done) {
      app.formio.mongoose.models.role.find()
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 3);
          template.roles = {};
          results.forEach(function(role) {
            template.roles[role.title] = role;
          });

          assert.equal(template.roles.Administrator.machineName, 'formio:administrator');
          assert.equal(template.roles.Authenticated.machineName, 'formio:authenticated');
          assert.equal(template.roles.Anonymous.machineName, 'formio:anonymous');

          done();
        });
    });

    it('installs one project named formio', function(done) {
      app.formio.resources.project.model.find({})
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 1);
          template.project = results[0];
          template.project.accessObject = {};
          template.project.access.forEach(function(access) {
            template.project.accessObject[access.type] = access.roles;
          });
          assert.equal(template.project.name, 'formio');
          assert.equal(template.project.machineName, 'formio');
          assert.equal(template.project.accessObject.create_all.length, 1);
          assert.notEqual(template.project.accessObject.create_all.indexOf(template.roles.Administrator._id), -1);
          assert.equal(template.project.accessObject.read_all.length, 2);
          assert.notEqual(template.project.accessObject.read_all.indexOf(template.roles.Administrator._id), -1);
          assert.notEqual(template.project.accessObject.read_all.indexOf(template.roles.Anonymous._id), -1);
          assert.equal(template.project.accessObject.update_all.length, 1);
          assert.notEqual(template.project.accessObject.update_all.indexOf(template.roles.Administrator._id), -1);
          assert.equal(template.project.accessObject.delete_all.length, 1);
          assert.notEqual(template.project.accessObject.delete_all.indexOf(template.roles.Administrator._id), -1);
          done();
        });
    });

    it('Should put the roles in the project', function(done) {
      assert.equal(template.roles.Administrator.project._id, template.project._id._id);
      assert.equal(template.roles.Authenticated.project._id, template.project._id._id);
      assert.equal(template.roles.Anonymous.project._id, template.project._id._id);
      done();
    });

    it('creates one resource named user', function(done) {
      app.formio.resources.form.model.find({
          type: 'resource'
        })
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 1);
          assert.equal(results[0].name, 'user');
          template.resources = {};
          template.resources[results[0].name] = results[0];
          assert.equal(template.resources.user.title, 'User');
          assert.equal(template.resources.user.machineName, 'formio:user');
          assert.equal(template.resources.user.project._id, template.project._id._id);
          template.resources.user.accessObject = {};
          template.resources.user.access.forEach(function(access) {
            template.resources.user.accessObject[access.type] = access.roles;
          });
          assert.equal(template.project.accessObject.read_all.length, 2);
          assert.notEqual(template.project.accessObject.read_all.indexOf(template.roles.Administrator._id), -1);
          assert.notEqual(template.project.accessObject.read_all.indexOf(template.roles.Anonymous._id), -1);
          done();
        });
    });

    it('creates one form named user login', function(done) {
      app.formio.resources.form.model.find({
          type: 'form'
        })
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 1);
          assert.equal(results[0].name, 'userLogin');
          template.forms = {};
          template.forms[results[0].name] = results[0];
          assert.equal(template.forms.userLogin.title, 'User Login');
          assert.equal(template.forms.userLogin.machineName, 'formio:userLogin');
          assert.equal(template.forms.userLogin.project._id, template.project._id._id);
          done();
        });
    });

    it('creates three actions', function(done) {
      app.formio.mongoose.models.action.find()
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 3);
          template.actions = {};
          results.forEach(function(action) {
            template.actions[action.name] = action;
          });

          assert.equal(template.actions.save.title, 'Save Submission');
          assert.equal(template.actions.save.machineName, 'formio:user:userSave');
          assert.equal(template.actions.save.form._id, template.resources.user._id._id);

          assert.equal(template.actions.role.title, 'Role Assignment');
          assert.equal(template.actions.role.machineName, 'formio:user:userRole');
          assert.equal(template.actions.role.form._id, template.resources.user._id._id);

          assert.equal(template.actions.login.title, 'Login');
          assert.equal(template.actions.login.machineName, 'formio:userLogin:userLoginLogin');
          assert.equal(template.actions.login.form._id, template.forms.userLogin._id._id);

          done();
        });
    });

    it('creates the administrative account', function(done) {
      app.formio.resources.submission.model.find()
        .exec(function(err, results) {
          if (err) {
            return done(err);
          }

          assert.equal(results.length, 1);
          template.owner = results[0];
          assert.equal(template.owner.form._id, template.resources.user._id._id);

          assert.equal(template.owner.roles.length, 1);
          assert.notEqual(template.owner.roles.indexOf(template.roles.Administrator._id), -1);
          done();
        });
    });

    it('assigns the admin to be the owner of the project', function(done) {
      assert.equal(template.project.owner._id, template.owner._id._id);
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
      console.log('/project/' + project._id + '/form/' + forms.userLogin._id + '/submission');
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

  });
};
