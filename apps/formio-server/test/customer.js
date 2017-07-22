/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');
var _ = require('lodash');
var express = require('express');
var path = require('path');
var async = require('async');
var chance = new (require('chance'))();
var docker = process.env.DOCKER;
var customer = process.env.CUSTOMER;
var app = null;
var hook = null;
var template = _.cloneDeep(require('formio/test/fixtures/template')());
let EventEmitter = require('events');

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});

process.on('unhandledRejection', (err) => {
  console.log(err.stack);
});

describe('Initial Tests', function() {
  before(function(done) {
    var hooks = _.merge(require('formio/test/hooks'), require('./tests/hooks')); // Merge all the test hooks.
    if (!docker && !customer) {
      require('../server')({
        hooks: hooks
      })
        .then(function(state) {
          app = state.app;
          hook = require('formio/src/util/hook')(app.formio.formio);

          // Establish the helper library.
          template.Helper = require('./tests/Helper')(app, require('formio/test/helper')(app));
          template.hooks = app.formio.formio.hooks || {};
          template.hooks.addEmitter(new EventEmitter());
          return done();
        });
    }
    else if (customer) {
      app = 'http://api.localhost:3000';
      hook = require('formio/src/util/hook')({hooks: hooks});
      template.hooks = hooks;
      template.hooks.addEmitter(new EventEmitter());
      return done();
    }
    else if (docker) {
      app = 'http://api.localhost:3000';
      hook = require('formio/src/util/hook')({hooks: hooks});
      template.hooks = hooks;
      template.hooks.addEmitter(new EventEmitter());
      return done();
    }
    else {
      console.error('Unknown environment..');
      process.exit();
    }
  });

  /**
   * Create a simulated Form.io environment for testing.
   */
  describe('Bootstrap', function() {
    after(function() {
      describe('Project Tests', function() {
        require('./tests/project')(app, template, hook);
        require('./tests/domain')(app, template, hook);
        require('./tests/email')(app, template, hook);
        require('formio/test/unit')(app, template, hook);
        require('formio/test/auth')(app, template, hook);
        require('./tests/externalTokens')(app, template, hook);
        require('formio/test/roles')(app, template, hook);
        require('formio/test/form')(app, template, hook);
        require('formio/test/resource')(app, template, hook);
        require('formio/test/nested')(app, template, hook);
        require('formio/test/actions')(app, template, hook);
        require('formio/test/submission')(app, template, hook);
        require('formio/test/submission-access')(app, template, hook);
        require('./tests/analytics')(app, template, hook);
        require('./tests/teams')(app, template, hook);
        require('./tests/env')(app, template, hook);
        require('./tests/tags')(app, template, hook);
        require('./tests/misc')(app, template, hook);
        require('./tests/oauth')(app, template, hook);
        require('./tests/s3')(app, template, hook);
        require('./tests/dropbox')(app, template, hook);
        require('./tests/report')(app, template, hook);
        require('./tests/actions')(app, template, hook);
        require('./tests/group-permissions')(app, template, hook);
        require('formio/test/templates')(app, template, hook);
        require('./tests/templates')(app, template, hook);
      });
    });
  });
});
