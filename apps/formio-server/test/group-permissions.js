/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var Q = require('q');
var async = require('async');
var chance = new (require('chance'))();
var util = require('formio/src/util/util');
var async = require('async');
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;

module.exports = function(app, template, hook) {
  var deleteForms = function(forms, next) {
    async.each(forms, function(item, cb) {
      request(app)
        .delete(hook.alter('url', '/form', template) + '/' + item._id)
        .set('x-jwt-token', template.users.admin.token)
        .end(function(err, res) {
          if (err) {
            return cb(err);
          }

          cb();
        });
    }, function(err) {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  var deleteSubmissions = function(submissions, next) {
    async.each(submissions, function(item, cb) {
      request(app)
        .delete(hook.alter('url', '/form', template) + '/' + item.form + '/submission/' + item._id)
        .set('x-jwt-token', template.users.admin.token)
        .end(function(err, res) {
          if (err) {
            return cb(err);
          }

          cb();
        });
    }, function(err) {
      if (err) {
        return next(err);
      }

      return next();
    });
  };

  describe('Group Permissions', function() {
    describe('Group Assignment Action', function() {
      var form = null;
      var group = null;
      var groupUser = null;
      var submissions = [];

      describe('Bootstrap', function() {
        it('Create the form', function(done) {

        });
      });

      describe('Group Resource Assignment', function() {
        it('Create the group', function(done) {

        });

        it('Create the group proxy resource', function(done) {

        });

        it('Create the group resource assignment action', function(done) {

        });

        it('A submission to the group proxy will assign group access to the user resource', function(done) {

        });

        it('A user can not assign group access that they do not have access to', function(done) {

        });
      });

      describe('Self Assignment', function() {
        it('Create the group resource assignment action', function(done) {

        });

        it('A submission to the user resource, will create a user with new a group role', function(done) {

        });

        it('A user can not assign group access that they do not have access to', function(done) {

        });
      });
    });

    describe('Submissions', function() {
      var form = null;
      var group = null;
      var submission = [];

      describe('Bootstrap', function() {
        it('Create the form', function(done) {

        });

        it('Create the group', function(done) {

        });

        it('Create the submission', function(done) {

        });
      });

      describe('read access', function() {
        before(function(done) {
          // Clear the submission group access
        });

        it('A user without group access, should not be able to read a submission', function(done) {

        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {

        });

        it('A user without group access, should not be able to update a submission', function(done) {

        });

        it('A user without group access, should not be able to delete a submission', function(done) {

        });

        it('An Administrative user can grant read access for the group', function(done) {

        });

        it('A user with group access, should be able to read a submission', function(done) {

        });

        it('A user with group access, should be able to read a submission through the index', function(done) {

        });

        it('A user with group access, should not be able to update a submission', function(done) {

        });

        it('A user with group access, should not be able to delete a submission', function(done) {

        });
      });

      describe('write access', function() {
        before(function(done) {
          // Clear the submission group access
        });

        it('A user without group access, should not be able to read a submission', function(done) {

        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {

        });

        it('A user without group access, should not be able to update a submission', function(done) {

        });

        it('A user without group access, should not be able to delete a submission', function(done) {

        });

        it('An Administrative user can grant write access for the group', function(done) {

        });

        it('A user with group access, should be able to read a submission', function(done) {

        });

        it('A user with group access, should be able to read a submission through the index', function(done) {

        });

        it('A user with group access, should be able to update a submission', function(done) {

        });

        it('A user with group access, should not be able to delete a submission', function(done) {

        });
      });

      describe('admin access', function() {
        before(function(done) {
          // Clear the submission group access
        });

        it('A user without group access, should not be able to read a submission', function(done) {

        });

        it('A user without group access, should not be able to read a submission through the index', function(done) {

        });

        it('A user without group access, should not be able to update a submission', function(done) {

        });

        it('A user without group access, should not be able to delete a submission', function(done) {

        });

        it('An Administrative user can grant admin access for the group', function(done) {

        });

        it('A user with group access, should be able to read a submission', function(done) {

        });

        it('A user with group access, should be able to read a submission through the index', function(done) {

        });

        it('A user with group access, should be able to update a submission', function(done) {

        });

        it('A user with group access, should be able to delete a submission', function(done) {

        });
      });
    });
  });
};