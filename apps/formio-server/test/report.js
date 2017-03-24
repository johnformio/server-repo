/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
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
      count = (count > 0) ? (count - 1) : 1;
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$limit': count
        }]))
        .expect(206)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.length, count);
          done();
        });
    });

    it('Should allow ObjectId in aggregation (single quotes).', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'form': `ObjectId('${template.resources.user._id}')`
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow ObjectId in aggregation (double quotes).', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'form': `ObjectId("${template.resources.user._id}")`
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (plain time input).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date(${yesterday})`,
              '$lte': `Date(${now})`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (time input w/ single quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date('${yesterday}')`,
              '$lte': `Date('${now}')`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (time input w/ double quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date("${yesterday}")`,
              '$lte': `Date("${now}")`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (plain date string input).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date(${yesterday.toString()})`,
              '$lte': `Date(${now.toString()})`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (date string input w/ single quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date('${yesterday.toString()}')`,
              '$lte': `Date('${now.toString()}')`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (date input w/ double quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date("${yesterday.toString()}")`,
              '$lte': `Date("${now.toString()}")`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });
  });
};
