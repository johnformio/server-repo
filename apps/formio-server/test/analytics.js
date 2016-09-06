/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var docker = process.env.DOCKER;

module.exports = function(app, template, hook) {
  describe('Analytics', function() {
    if (docker) {
      return;
    }

    var redis = app.formio.analytics.getRedis();
    describe('Bootstrap', function() {
      it('Should clear all the redis data', function(done) {
        redis.flushall(function(err, val) {
          if (err) {
            return done(err);
          }

          assert.equal(val, 'OK');
          done();
        });
      });
    });

    describe('Analytics tracking', function() {
      it('A request to a project endpoint should be tracked as a non-submission request', function(done) {
        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var curr = new Date();
            var key = curr.getUTCFullYear() + ':' + curr.getUTCMonth() + ':' + curr.getUTCDate() +  ':' + template.project._id + ':ns';
            redis.llen(key, function(err, length) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(length, 1);
              assert.equal(response.plan, 'basic');

              template.project = response;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];
              done();
            });
          });
      });

      it('The projects submission based requests should be 0', function(done) {
        var curr = new Date();
        app.formio.analytics.getCalls(curr.getUTCFullYear(), curr.getUTCMonth(), curr.getUTCDate(), template.project._id, function(err, calls) {
          if (err) {
            return done(err);
          }

          assert.equal(calls, 0);
          done();
        });
      });

      it('A request to a submission endpoint should be tracked as a submission request', function(done) {
        request(app)
          .get('/project/' + template.project._id + '/form/' + template.resources.user._id + '/submission/' + template.users.user1._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var curr = new Date();
            app.formio.analytics.getCalls(curr.getUTCFullYear(), curr.getUTCMonth(), curr.getUTCDate(), template.project._id, function(err, calls) {
              if (err) {
                return done(err);
              }

              assert.equal(calls, 1);
              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];
              done();
            });
          });
      });

      it('A project which has exceeded its API limit should still fulfill requests (throttled)', function(done) {
        // Override the basic project limits for tests.
        var old = app.formio.formio.plans.limits['basic'];
        app.formio.formio.plans.limits['basic'] = 1;

        request(app)
          .get('/project/' + template.project._id + '/form/' + template.resources.user._id + '/submission/' + template.users.user1._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var curr = new Date();
            var key = curr.getUTCFullYear() + ':' + curr.getUTCMonth() + ':' + curr.getUTCDate() +  ':' + template.project._id + ':s';
            redis.llen(key, function(err, length) {
              if (err) {
                return done(err);
              }

              assert.equal(length, 2);
              assert.equal(length > app.formio.formio.plans.limits['basic'], true);

              // Reset the basic plan limits.
              app.formio.formio.plans.limits['basic'] = old;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];
              done();
            });
          });
      });

      it('A request to a undefined project endpoint should not be tracked as a non-submission request', function(done) {
        request(app)
          .get('/project/undefined')
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var curr = new Date();
            var key = curr.getUTCFullYear() + ':' + curr.getUTCMonth() + ':' + curr.getUTCDate() +  ':undefined:ns';
            redis.llen(key, function(err, calls) {
              if (err) {
                return done(err);
              }

              assert.equal(calls, 0);
              done();
            });
          });
      });

      it('A request to a malformed project endpoint should not be tracked as a non-submission request', function(done) {
        request(app)
          .get('/project/submission')
          .set('x-jwt-token', template.formio.owner.token)
          .expect(400)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var curr = new Date();
            var key = curr.getUTCFullYear() + ':' + curr.getUTCMonth() + ':' + curr.getUTCDate() +  ':submission:ns';
            redis.llen(key, function(err, calls) {
              if (err) {
                return done(err);
              }

              assert.equal(calls, 0);
              done();
            });
          });
      });
    });

    describe('Yearly Analytics - /project/:projectId/analytics/year/:year', function() {
      it('A Project Owner should be able to request the yearly analytics', function(done) {
        var curr = new Date();
        request(app)
          .get('/project/' + template.project._id + '/analytics/year/' + curr.getUTCFullYear())
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            // Check the response payload for the correct format.
            assert.equal(response instanceof Array, true);
            assert.equal(response.length, 12);
            _.forEach(response, function(_month) {
              assert.equal(_month.hasOwnProperty('month'), true);
              assert.equal(_month.hasOwnProperty('days'), true);
              assert.equal(_month.hasOwnProperty('submissions'), true);
            });

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            // @TODO: Add verification to check that the given data was correct.
            done();
          });
      });

      it('An anonymous user should not be able to request the yearly analytics', function(done) {
        var curr = new Date();
        request(app)
          .get('/project/' + template.project._id + '/analytics/year/' + curr.getUTCFullYear())
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.text;
            assert.equal(response, 'Unauthorized');

            done();
          });
      });
    });

    describe('Monthly Analytics - /project/:projectId/analytics/year/:year/month/:month', function() {
      it('A Project Owner should be able to request the monthly analytics', function(done) {
        var curr = new Date();
        request(app)
          .get('/project/' + template.project._id + '/analytics/year/' + curr.getUTCFullYear() + '/month/' + (curr.getUTCMonth() + 1))
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var daysInMonth = (new Date(parseInt(curr.getUTCFullYear()), parseInt(curr.getUTCMonth()) + 1, 0)).getUTCDate();
            var response = res.body;
            // Check the response payload for the correct format.
            assert.equal(response instanceof Array, true);
            assert.equal(response.length, daysInMonth);
            _.forEach(response, function(_day) {
              assert.equal(_day.hasOwnProperty('day'), true);
              assert.equal(_day.hasOwnProperty('submissions'), true);
            });

            // Check the request count for the current day.
            var key = app.formio.analytics.getAnalyticsKey(template.project._id, curr.getUTCFullYear(), curr.getUTCMonth(), curr.getUTCDate(), 's');
            redis.llen(key, function(err, len) {
              if(err) {
                return done(err);
              }

              // Check that the response has the correct data, only this day has data.
              for(var pos = 0; pos < daysInMonth; pos++) {
                if(pos === (curr.getUTCDate()-1)) {
                  assert.equal(response[pos].submissions, len);
                }
                else {
                  assert.equal(response[pos].submissions, 0);
                }
              }

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              // @TODO: Add more verification to check that the given data was correct.
              done();
            });
          });
      });

      it('An anonymous user should not be able to request the monthly analytics', function(done) {
        var curr = new Date();
        request(app)
          .get('/project/' + template.project._id + '/analytics/year/' + curr.getUTCFullYear() + '/month/' + (curr.getUTCMonth() + 1))
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.text;
            assert.equal(response, 'Unauthorized');

            done();
          });
      });
    });

    describe('Daily Analytics - /project/:projectId/analytics/year/:year/month/:month/day/:day', function() {
      it('A Project Owner should be able to request the monthly analytics', function(done) {
        var curr = new Date();
        request(app)
          .get('/project/' + template.project._id + '/analytics/year/' + curr.getUTCFullYear() + '/month/' + (curr.getUTCMonth() + 1) + '/day/' + curr.getUTCDate())
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            // Check the response payload for the correct format.
            assert.equal(response instanceof Object, true);
            assert.equal(response.hasOwnProperty('submissions'), true);
            assert.equal(response.submissions instanceof Array, true);
            _.forEach(response.submissions, function(_timestamp) {
              assert.equal(_.isString(_timestamp), true);
            });

            var key = app.formio.analytics.getAnalyticsKey(template.project._id, curr.getUTCFullYear(), curr.getUTCMonth(), curr.getUTCDate(), 's');
            redis.llen(key, function(err, length) {
              if(err) {
                return done(err);
              }

              assert.equal(response.submissions.length, length);

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              // @TODO: Add more verification to check that the given data was correct.
              done();
            });
          });
      });

      it('An anonymous user should not be able to request the monthly analytics', function(done) {
        var curr = new Date();
        request(app)
          .get('/project/' + template.project._id + '/analytics/year/' + curr.getUTCFullYear() + '/month/' + (curr.getUTCMonth() + 1) + '/day/' + curr.getUTCDate())
          .expect('Content-Type', /text/)
          .expect(401)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.text;
            assert.equal(response, 'Unauthorized');

            done();
          });
      });
    });

    describe('Crash Redis', function() {
      it('The API server will run smoothly without analytics', function(done) {
        var old = app.formio.analytics.redis;
        app.formio.analytics.redis = null;

        request(app)
          .get('/project/' + template.project._id)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) {
              return done(err);
            }

            var response = res.body;
            assert.equal(response.plan, 'basic');

            template.project = res.body;

            // Store the JWT for future API calls.
            template.formio.owner.token = res.headers['x-jwt-token'];

            // Reset the redis ref.
            app.formio.analytics.redis = old;

            done();
          });
      });

      it('The API server will run smoothly without analytics if redis crashes', function(done) {
        redis.debug('segfault', function() {
          request(app)
            .get('/project/' + template.project._id)
            .set('x-jwt-token', template.formio.owner.token)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              var response = res.body;
              assert.equal(response.plan, 'basic');

              template.project = res.body;

              // Store the JWT for future API calls.
              template.formio.owner.token = res.headers['x-jwt-token'];

              done();
            });
        });
      });
    });
  });
};
