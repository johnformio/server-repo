'use strict';

var _ = require('lodash');
var debug = {
  config: require('debug')('formio:config')
};
var config = {formio: {}};
var protocol = process.env.PROTOCOL || 'https';
var project = process.env.PROJECT || 'formio';
var plan = process.env.PROJECT_PLAN || 'commercial';
var fs = require('fs');

try {
  fs.statSync('/.dockerenv');
  config.docker = true;
}
catch (e) {
  config.docker = false;
}

config.reservedSubdomains = ['test', 'www', 'api', 'help', 'support', 'portal', 'app', 'apps'];
config.formio.reservedForms = [
  'submission',
  'report',
  'exists',
  'export',
  'role',
  'current',
  'logout',
  'import',
  'form',
  'storage\/s3',
  'storage\/dropbox',
  'dropbox\/auth',
  'upgrade',
  'access',
  'atlassian\/oauth\/authorize',
  'atlassian\/oauth\/finalize',
  'sqlconnector'
];

// Set the App settings.
var domain = process.env.DOMAIN || 'form.io';
var port = process.env.PORT || 80;
var host = protocol + '://' + domain;
var apiHost = protocol + '://api.' + domain;
var formioHost = protocol + '://' + project + '.' + domain;

// Setup Google Analytics.
config.gaTid = process.env.GOOGLE_ANALYTICS_TID || '';

if (port !== 80) {
  host += ':' + port;
  apiHost += ':' + port;
  formioHost += ':' + port;
}

// Configure app server settings.
config.debug = process.env.DEBUG || false;
config.https = (protocol === 'https');
config.protocol = protocol;
config.domain = domain;
config.formio.domain = domain;
config.formio.protocol = protocol;
config.formio.baseUrl = domain + (port !== 80 ? ':' + port : '');
config.port = port;
config.host = host;

config.project = project;
config.plan = plan;
config.apiHost = apiHost;
config.formio.apiHost = apiHost;
config.formioHost = formioHost;
config.formio.formioHost = formioHost;

// Payeezy fields
config.payeezy = {
  keyId: process.env.PAYEEZY_KEY_ID,
  host: process.env.PAYEEZY_HOST || 'api.globalgatewaye4.firstdata.com',
  endpoint: process.env.PAYEEZY_ENDPOINT || '/transaction/v19',
  gatewayId: process.env.PAYEEZY_GATEWAY_ID,
  gatewayPassword: process.env.PAYEEZY_GATEWAY_PASSWORD,
  hmacKey: process.env.PAYEEZY_HMAC_KEY
};

// Using docker, support legacy linking and network links.
var mongoCollection = process.env.MONGO_COLLECTION || 'formio';
if (process.env.MONGO_PORT_27017_TCP_ADDR) {
  // This is compatible with docker legacy linking.
  var mongoAddr = process.env.MONGO_PORT_27017_TCP_ADDR || 'mongo';
  var mongoPort = process.env.MONGO_PORT_27017_TCP_PORT || 27017;
  config.formio.mongo = 'mongodb://' + mongoAddr + ':' + mongoPort + '/' + mongoCollection;
}
else {
  if (config.docker) {
    // New docker network linking. Assumes linked with 'mongo' alias.
    config.formio.mongo = 'mongodb://mongo/' + mongoCollection;
  }
  else {
    config.formio.mongo = 'mongodb://localhost:27017/' + mongoCollection;
  }
}

if (process.env.REDIS_ADDR || process.env.REDIS_PORT_6379_TCP_ADDR) {
  // This is compatible with docker legacy linking.
  var addr = process.env.REDIS_ADDR || process.env.REDIS_PORT_6379_TCP_ADDR;
  var redisPort = process.env.REDIS_PORT || process.env.REDIS_PORT_6379_TCP_PORT;
  config.redis = {
    url: 'redis://' + addr + ':' + redisPort
  };
}
else {
  if (config.docker) {
    // New docker network linking. Assumes linked with 'redis' alias.
    config.redis = {
      url: 'redis://redis'
    };
  }
  else {
    config.redis = {
      url: 'redis://localhost:6379'
    };
  }
}

if (process.env.REDIS_PASS) {
  config.redis.password = process.env.REDIS_PASS;
}

// Allow manually setting mongo connection.
if (process.env.MONGO1) {
  config.formio.mongo = [];
  config.formio.mongo.push(process.env.MONGO1);
  if (process.env.MONGO2) {
    config.formio.mongo.push(process.env.MONGO2);
  }
  if (process.env.MONGO3) {
    config.formio.mongo.push(process.env.MONGO3);
  }
}

// This secret is used to encrypt certain DB fields at rest in the mongo database
config.formio.mongoSecret = process.env.DB_SECRET || 'abc123';
config.formio.mongoSecretOld = process.env.DB_SECRET_OLD || false;

// TODO: Need a better way of setting the formio specific configurations.
if (process.env.SENDGRID_USERNAME) {
  config.formio.email = {};
  config.formio.email.type = 'sendgrid';
  config.formio.email.username = process.env.SENDGRID_USERNAME;
  config.formio.email.password = process.env.SENDGRID_PASSWORD;
}

config.formio.dropbox = {};
config.formio.dropbox.clientId = process.env.DROPBOX_CLIENTID || '';
config.formio.dropbox.clientSecret = process.env.DROPBOX_CLIENTSECRET || '';

// Add the JWT data.
config.formio.jwt = {};
config.formio.jwt.secret = process.env.JWT_SECRET || 'abc123';
config.formio.jwt.expireTime = process.env.JWT_EXPIRE_TIME || 240;
config.jslogger = process.env.JS_LOGGER || null;

// Allow the config to be displayed when debugged.
var sanitized = _.clone(config, true);
sanitized = _.pick(sanitized, [
  'https', 'domain', 'port', 'host', 'project', 'plan', 'formioHost', 'apiHost', 'debug', 'redis', 'docker'
]);
sanitized.formio = _.pick(_.clone(config.formio), ['domain', 'schema', 'mongo']);

// Only output sanitized data.
debug.config(sanitized);
module.exports = config;
