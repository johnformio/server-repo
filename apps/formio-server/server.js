'use strict';

require('dotenv').load({silent: true});
var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var Q = require('q');

module.exports = function(options) {
  options = options || {};
  var q = Q.defer();

  // Use the express application.
  var app = options.app || express();

  // Use the given config.
  var config = options.config || require('./config');

  // Add jslogger if configured.
  var jslogger = null;
  if (config.jslogger) {
    jslogger = require('jslogger')({key: config.jslogger});
  }

  // Load the analytics hooks.
  var analytics = require('./src/analytics/index')(config);

  var Logger = require('./src/logger/index')(config);

  // Ensure that we create projects within the helper.
  app.hasProjects = true;

  // Create the app server.
  app.server = require('http').createServer(app);
  app.listen = function() {
    return app.server.listen.apply(app.server, arguments);
  };

  // Hook each request and add analytics support.
  app.use(analytics.hook);

  app.use(favicon(__dirname + '/favicon.ico'));

  // Add Middleware necessary for REST API's
  app.use(bodyParser.urlencoded({extended: true, limit: '16mb'}));
  app.use(bodyParser.json({limit: '16mb'}));
  app.use(methodOverride('X-HTTP-Method-Override'));

  // Error handler for malformed JSON
  app.use(function(err, req, res, next) {
    if (err instanceof SyntaxError) {
      return res.status(400).send(err.message);
    }

    next();
  });

  // Create the formio server.
  app.formio = options.server || require('formio')(config.formio);
  app.use(app.formio.formio.middleware.restrictRequestTypes);

  // Attach the formio-server config.
  app.formio.config = _.omit(config, 'formio');

  // Attach the analytics to the formio server and attempt to connect.
  app.formio.analytics = analytics;
  app.formio.analytics.connect(); // Try the connection on server start.

  // Import the OAuth providers
  app.formio.formio.oauth = require('./src/oauth/oauth')(app.formio.formio);

  // Make sure to redirect all http requests to https.
  app.use(function(req, res, next) {
    if (!config.https || req.secure || (req.get('X-Forwarded-Proto') === 'https') || req.url === '/health') {
      return next();
    }

    res.redirect('https://' + req.get('Host') + req.url);
  });

  // Establish our url alias middleware.
  app.use(require('./src/middleware/alias')(app.formio.formio));

  // CORS Support
  var corsRoute = require('cors')(require('./src/middleware/corsOptions')(app));
  app.use(corsRoute);

  // Handle our API Keys.
  app.use(require('./src/middleware/apiKey')(app.formio.formio));

  // Adding google analytics to our api.
  if (config.gaTid) {
    var ua = require('universal-analytics');
    app.use(function(req, res, next) {
      next(); // eslint-disable-line callback-return

      var visitor = ua(config.gaTid);
      visitor.pageview(req.url).send();
    });
  }

  app.modules = require('./src/modules/modules')(app, config);
  var hooks = _.merge(require('./src/hooks/settings')(app), options.hooks);

  // Start the api server.
  app.formio.init(hooks).then(function(formio) {
    var start = function() {
      // The formio app sanity endpoint.
      app.get('/health', require('./src/middleware/health')(app.formio.formio), formio.update.sanityCheck);

      // Respond with default server information.
      app.get('/', require('./src/middleware/projectIndex')(app.formio.formio));

      // Mount formio at /project/:projectId.
      app.use('/project/:projectId', app.formio);

      // Mount the aggregation system.
      app.use('/project/:projectId/report', require('./src/middleware/report')(app.formio));

      // Mount the error logging middleware.
      app.use(Logger.middleware);

      return q.resolve({
        app: app,
        config: config
      });
    };

    app.storage = require('./src/storage/index.js')(app);

    formio.db.collection('projects').count(function(err, numProjects) {
      if (!err && numProjects > 0) {
        return start();
      }
      /* eslint-disable no-console */
      console.log(' > No projects found. Setting up server.');
      /* eslint-enable no-console */

      require('./install')(formio, function(err) {
        if (err) {
          // Throw an error and exit.
          throw new Error(err);
        }
        return start();
      });
    });
  });

  // Do some logging on uncaught exceptions in the application.
  process.on('uncaughtException', function(err) {
    if (config.jslogger && jslogger) {
      /* eslint-disable no-console */
      console.log('Uncaught exception:');
      console.log(err);
      console.log(err.stack);
      /* eslint-enable no-console */

      jslogger.log({
        message: err.stack || err.message,
        fileName: err.fileName,
        lineNumber: err.lineNumber
      });
    }

    if (Logger.middleware) {
      Logger.middleware(err, {});
    }

    // Give the loggers some time to log before exiting.
    setTimeout(function() {
      process.exit(1);
    }, 2500);
  });

  return q.promise;
};
