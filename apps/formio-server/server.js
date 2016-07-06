'use strict';

require('dotenv').load({silent: true});
var config = require('./config');
var jslogger = null;
if (config.jslogger) {
  jslogger = require('jslogger')({key: config.jslogger});
}
var express = require('express');
var _ = require('lodash');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var app = express();
var favicon = require('serve-favicon');
var analytics = require('./src/analytics/index')(config);

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
app.use(function (error, req, res, next){
  //Catch json error
  next();
});
app.use(methodOverride('X-HTTP-Method-Override'));

// Error handler for malformed JSON
app.use(function(err, req, res, next) {
  if (err instanceof SyntaxError) {
    return res.status(400).send(err.message);
  }

  next();
});

// Create the formio server.
app.formio = require('formio')(config.formio);

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

// CORS Support
app.use(require('cors')());

// Host the dynamic app configuration.
app.get('/config.js', function(req, res) {
  res.set('Content-Type', 'text/javascript');
  res.render('js/config.js', {
    forceSSL: config.https ? 'true' : 'false',
    domain: config.domain,
    appHost: config.host,
    apiHost: config.apiHost,
    formioHost: config.formioHost
  });
});

// Establish our url alias middleware.
app.use(require('./src/middleware/alias')(app.formio.formio));

// Handle our API Keys.
app.use(require('./src/middleware/apiKey')(app.formio.formio));

// Adding google analytics to our api.
if (config.gaTid) {
  var ua = require('universal-analytics');
  app.use(function(req, res, next) {
    /* eslint-disable callback-return */
    next();
    /* eslint-enable callback-return */

    var visitor = ua(config.gaTid);
    visitor.pageview(req.url).send();
  });
}

app.modules = require('./src/modules/modules')(app, config);
var settings = require('./src/hooks/settings')(app);

// Start the api server.
app.formio.init(settings).then(function(formio) {
  var start = function() {
    // The formio app sanity endpoint.
    app.get('/health', require('./src/middleware/health')(app.formio.formio), formio.update.sanityCheck);

    // Respond with default server information.
    app.get('/', require('./src/middleware/projectIndex')(app.formio.formio));

    // Mount formio at /project/:projectId.
    app.use('/project/:projectId', app.formio);

    // Mount the aggregation system.
    app.use('/project/:projectId/report', require('./src/middleware/report')(app.formio.formio));

    /* eslint-disable no-console */
    console.log(' > Listening to ' + config.protocol + '://' + config.domain + ':' + config.port);
    /* eslint-enable no-console */
    app.listen(config.port);
  };

  app.storage = require('./src/storage')(app);

  formio.db.collection('projects').count(function(err, numProjects) {
    if (!err && numProjects > 0) {
      return start();
    }
    else {
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
    }
  });
});

if (config.jslogger && jslogger) {
  process.on('uncaughtException', function(err) {
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

    // Give jslogger time to log before exiting.
    setTimeout(function() {
      process.exit(1);
    }, 1500);
  });
}
