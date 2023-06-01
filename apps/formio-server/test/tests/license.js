'use strict';

const request = require('supertest');
const assert = require('assert');
const chance = new (require('chance'))();
const _ = require('lodash');
const config = require('../../config');

module.exports = function(app, template, hook) {
  describe('License Tests', function() {
    if (config.formio.hosted) {
      describe('License Limits Tests', function() {
        let originalStageLimit = app.license.terms.stages;

        before(function(done) {
          // Live and first stages should be created, second stage should throw error
          app.license.terms.stages = 2;
          const licenseLimitsProject = {
            title: 'License Limits',
            description: chance.sentence(),
            plan: 'commercial',
            template: _.pick(template, ['title', 'name', 'version', 'description', 'roles', 'resources', 'forms', 'actions', 'access'])
          };

          request(app)
            .post('/project')
            .send(licenseLimitsProject)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              template.licenseLimitsProject = res.body;

              done();
            });
        });

        it('Should create stage without errors', function(done) {
          const stage = {
            project: template.licenseLimitsProject._id,
            title: 'Stage 1',
            type: 'stage'
          };

          request(app)
            .post('/project')
            .send(stage)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(201)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }
              done();
            })
        });

        it('Should count live stage as general stage in license limits and throw exceeding error', function(done) {
          const stage = {
            project: template.licenseLimitsProject._id,
            title: 'Stage 2',
            type: 'stage'
          };

          request(app)
            .post('/project')
            .send(stage)
            .set('x-jwt-token', template.formio.owner.token)
            .expect(400)
            .end(function(err, res) {
              if (err) {
                return done(err);
              }

              assert.match(res.text, /Exceeded the allowed number of stages./);

              done();
            })
        });

        after(function(done) {
          app.license.terms.stages = originalStageLimit;
          done();
        });
      });
    }
  });
}
