'use strict';
var request = require('supertest');
var chance = new (require('chance'))();
var _ = require('lodash');
var async = require('async');
module.exports = function(app, template, hook) {
  var series = [];
  return {
    template: {
      project: null,
      forms: {},
      actions: {},
      submissions: {}
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
          done(null, this.template.project);
        }.bind(this));
    },
    project: function() {
      series.push(this.createProject.bind(this));
      return this;
    },
    createForm: function(name, type, components, done) {
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }
      request(app)
        .post('/project/' + this.template.project._id + '/form')
        .send({
          title: name,
          name: name,
          path: name,
          type: type,
          access: [],
          submissionAccess: [],
          components: components
        })
        .set('x-jwt-token', template.formio.owner.token)
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          this.template.forms[name] = res.body;
          done(null, res.body);
        }.bind(this));
    },
    form: function(name, components) {
      series.push(async.apply(this.createForm.bind(this), name, 'form', components));
      return this;
    },
    resource: function(name, components) {
      series.push(async.apply(this.createForm.bind(this), name, 'resource', components));
      return this;
    },
    createAction: function(form, action, done) {
      if (!this.template.project || !this.template.project._id) {
        return done('No project defined');
      }
      if (!this.template.forms.hasOwnProperty(form)) {
        return done('Form not found');
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
        .expect(201)
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
