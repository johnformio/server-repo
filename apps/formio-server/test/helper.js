'use strict';
var request = require('supertest');
var chance = new (require('chance'))();
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
module.exports = function(app, template, hook) {
  var series = [];
  return {
    template: {
      project: null,
      forms: {},
      actions: {},
      submissions: {},
      roles: {}
    },
    getForms: function(done) {
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }
      request(app)
        .get('/project/' + this.template.project._id + '/form')
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          _.each(res.body, function(form) {
            this.template.forms[form.name] = form;
          }.bind(this));
          done(null, this.template.forms);
        }.bind(this));
    },
    getRoles: function(done) {
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }

      // Get the roles created for this project.
      request(app)
        .get('/project/' + this.template.project._id + '/role')
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          // Assign the roles.
          assert.equal(res.body.length, 3);
          _.each(res.body, function(role) {
            if (role.admin) {
              this.template.roles.administrator = role;
            }
            else if (role.default) {
              this.template.roles.anonymous = role;
            }
            else {
              this.template.roles.authenticated = role;
            }
          }.bind(this));
          assert.equal(Object.keys(this.template.roles).length, 3);
          done(null, this.template.roles);
        }.bind(this));
    },
    createProject: function(done) {
      request(app)
        .post('/project')
        .send({
          title: chance.word(),
          name: chance.word(),
          description: chance.sentence()
        })
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          this.template.project = res.body;
          async.series([
            async.apply(this.getForms.bind(this)),
            async.apply(this.getRoles.bind(this))
          ], function(err) {
            if (err) {
              return done(err);
            }
            done(null, this.template.project);
          }.bind(this));
        }.bind(this));
    },
    project: function() {
      series.push(this.createProject.bind(this));
      return this;
    },
    upsertForm: function(name, type, components, access, done) {
      if (typeof access === 'function') {
        done = access;
        access = null;
      }
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }

      // If no access is provided, then use the default.
      if (!access) {
        access = {
          submissionAccess: [],
          access: []
        };
      }

      // Convert the role names to role ids.
      ['access', 'submissionAccess'].forEach(function(accessName) {
        _.each(access[accessName], function(perm, i) {
          _.each(perm.roles, function(permRole, j) {
            if (this.template.roles.hasOwnProperty(permRole)) {
              access[accessName][i].roles[j] = this.template.roles[permRole]._id;
            }
          }.bind(this));
        }.bind(this));
      }.bind(this));

      var method = 'post';
      var status = 201;
      var url = '/project/' + this.template.project._id + '/form';
      var data = {
        title: name,
        name: name,
        path: name,
        type: type,
        access: access.access,
        submissionAccess: access.submissionAccess,
        components: components
      };
      if (this.template.forms.hasOwnProperty(name)) {
        method = 'put';
        status = 200;
        url += '/' + this.template.forms[name]._id;
        data = {
          components: components
        }
      }
      request(app)[method](url)
        .send(data)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(status)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          this.template.forms[name] = res.body;
          done(null, res.body);
        }.bind(this));
    },
    form: function(name, components, access) {
      series.push(async.apply(this.upsertForm.bind(this), name, 'form', components, access));
      return this;
    },
    resource: function(name, components, access) {
      series.push(async.apply(this.upsertForm.bind(this), name, 'resource', components, access));
      return this;
    },
    createAction: function(form, action, done) {
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }
      if (!this.template.forms.hasOwnProperty(form)) {
        return done('Form not found');
      }

      if (action.settings.resources) {
        var resources = [];
        _.each(action.settings.resources, function(resource) {
          if (this.template.forms.hasOwnProperty(resource)) {
            resources.push(this.template.forms[resource]._id);
          }
        }.bind(this));
        action.settings.resources = resources;
      }

      request(app)
        .post('/project/' + this.template.project._id + '/form/' + this.template.forms[form]._id + '/action')
        .send(action)
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          if (!this.template.actions[form]) {
            this.template.actions[form] = [];
          }
          this.template.actions[form].push(res.body);
          done(null, res.body);
        }.bind(this));
    },
    action: function(form, action) {
      series.push(async.apply(this.createAction.bind(this), form, action));
      return this;
    },
    createSubmission: function(form, data, done) {
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }
      if (!this.template.forms.hasOwnProperty(form)) {
        return done('Form not found');
      }

      request(app)
        .post('/project/' + this.template.project._id + '/form/' + this.template.forms[form]._id + '/submission')
        .send({
          data: data
        })
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          if (!this.template.submissions[form]) {
            this.template.submissions[form] = [];
          }

          this.template.submissions[form].push(res.body);
          done(null, res.body);
        }.bind(this));
    },
    submission: function(form, data) {
      series.push(async.apply(this.createSubmission.bind(this), form, data));
      return this;
    },
    execute: function(done) {
      return async.series(series, function(err) {
        series = [];
        if (err) {
          return done(err);
        }
        done(null, this.template);
      }.bind(this));
    }
  };
};
