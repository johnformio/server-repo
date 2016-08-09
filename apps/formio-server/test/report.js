/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  describe('Aggregation Reporting', function () {
    it('Should not allow aggregation for anonymous users.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .expect(401)
        .end(done);
    });

    var count = 0;
    it('Should allow aggregation for users with permission', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          count = res.body.length;

          done();
        });
    });

    it('Should not allow $lookup in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$lookup': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $project with anything other than integers in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$project': {
            "_id": 0,
            form: 1,
            owner: 'test'
          }
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should allow $project with only integers in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$project': {
            "_id": 0,
            form: 1,
            owner: 1
          }
        }]))
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should not allow $redact in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$redact': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $sample in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$sample': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $geoNear in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$geoNear': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $out in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$out': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $indexStats in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$indexStats': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $lookup in aggregation after other stages.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {},
          '$limit': {},
          '$skip': {},
          '$lookup': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should allow $limit in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$limit': 10
        }]))
        .expect(206)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          done();
        });
    });
  });
};
