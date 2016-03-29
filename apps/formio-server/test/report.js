/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var async = require('async');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  describe('Aggregation Reporting', function () {
    // Cannot run these tests without access to formio instance
    if (!app.formio) {
      return;
    }

    it('Should not allow aggregation for anonymous users.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .expect(401)
        .end(done);
    });
  });
};
