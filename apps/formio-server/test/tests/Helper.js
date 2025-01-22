'use strict';

var async = require('async');
var request = require('supertest');
var _ = require('lodash');
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;

module.exports = (app, Helper) => {
  if (!docker && !customer)
  Helper.prototype.setProjectPlan = function(plan, done) {
    if (!app.hasProjects && !docker) {
      return done('No project');
    }
    if (!this.template.project) {
      return done('No project');
    }

    request(app)
      .post('/project/' + this.template.project._id + '/upgrade')
      .set('x-jwt-token', this.owner.token)
      .send({plan})
      .expect(200)
      .end(done);
  };

  if (!docker && !customer)
  Helper.prototype.plan = function(plan) {
    this.series.push(async.apply(this.setProjectPlan.bind(this), plan));
    return this;
  };

  if (!docker && !customer)
  Helper.prototype.setProjectSettings = function(settings, done) {
    if (!app.hasProjects && !docker) {
      return done('No project');
    }
    if (!this.template.project) {
      return done('No project');
    }

    request(app)
      .put('/project/' + this.template.project._id)
      .set('x-jwt-token', this.owner.token)
      .send({settings: settings})
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err);
        }

        this.template.project = res.body;
        return done(null, res.body);
      }.bind(this));
  };

  Helper.prototype.getFormRevisions = function(form, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += '/project/' + this.template.project._id;
    }
    url += '/form/' + form._id + '/v';

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.getFormRevision = function(form, revId, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += '/project/' + this.template.project._id;
    }
    url += '/form/' + form._id + '/v/' + revId;

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.getFormRevisionByQueryParam = function(form, queryStr, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += '/project/' + this.template.project._id;
    }
    url += '/form/' + form._id + '?' + queryStr;

    request(app)
    .get(url)
    .set('x-jwt-token', this.owner.token)
    .expect('Content-Type', /json/)
    .expect(200)
    .end((err, res)=>{
      if (err) {
        return done(err, res);
      }
     done(null, res.body);
    })
  }

  Helper.prototype.getFormDraft = function(form, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += '/project/' + this.template.project._id;
    }
    url += '/form/' + form._id + '/draft';

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.putFormDraft = function(form, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += '/project/' + this.template.project._id;
    }
    url += '/form/' + form._id + '/draft';

    request(app).put(url)
      .send(_.omit(form, 'modified'))
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.getSubmissionRevisions = function(form, submission, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += `/project/${this.template.project._id}`;
    }
    url += `/form/${form._id}/submission/${submission._id}/v`;

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.getSubmissionRevision = function(form, submission, revId, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += `/project/${this.template.project._id}`;
    }
    url += `/form/${form._id}/submission/${submission._id}?submissionRevision=${revId}`;

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.getSubmissionRevisionChangeLog = function(form, submission, revId, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += `/project/${this.template.project._id}`;
    }
    url += `/form/${form._id}/submission/${submission._id}/changelog?submissionRevision=${revId}`;

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  Helper.prototype.getSubmissionChangeLog = function(form, submission, done) {
    let url = '';
    if (this.template.project && this.template.project._id) {
      url += `/project/${this.template.project._id}`;
    }
    url += `/form/${form._id}/submission/${submission._id}/changelog`;

    request(app).get(url)
      .send()
      .set('x-jwt-token', this.owner.token)
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err, res);
        }
        this.owner.token = res.headers['x-jwt-token'];
        done(null, res.body);
      });
  };

  if (!docker && !customer)
  Helper.prototype.settings = function(settings) {
    this.series.push(async.apply(this.setProjectSettings.bind(this), settings));
    return this;
  };

  return Helper;
};
