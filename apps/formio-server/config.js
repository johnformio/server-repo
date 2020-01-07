'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var debug = {
  config: require('debug')('formio:config')
};

const secrets = {};
if (process.env.DOCKER_SECRETS || process.env.DOCKER_SECRET) {
  try {
    debug.config('Loading Docker Secrets');
    const secretDir = process.env.DOCKER_SECRETS_PATH || '/run/secrets';
    if (fs.existsSync(secretDir)) {
      const files = fs.readdirSync(secretDir);
      if (files && files.length) {
        files.forEach(file => {
          const fullPath = path.join(secretDir, file);
          const key = file;
          const data = fs
            .readFileSync(fullPath, "utf8")
            .toString()
            .trim();

          secrets[key] = data;
        });
        debug.config('Docker Secrets Loaded');
      }
    }
  }
  catch (err) {
    debug.config('Cannot load Docker Secrets', err);
  }
}

// Find the config in either an environment variable or docker secret.
const getConfig = (key, defaultValue) => {
  // If there is a secret configuration for this key, return its value here.
  if (secrets.hasOwnProperty(key)) {
    return secrets[key];
  }
  // If an environment variable is set.
  if (process.env.hasOwnProperty(key)) {
    return process.env[key];
  }
  return defaultValue;
};

var config = {formio: {}};
var protocol = getConfig('PROTOCOL', 'https');
var project = getConfig('PROJECT', 'formio');
var plan = getConfig('PROJECT_PLAN', 'commercial');
const jwt = require('jsonwebtoken');

try {
  fs.statSync('/.dockerenv');
  config.docker = true;
}
catch (e) {
  config.docker = false;
}

config.reservedSubdomains = [
  '',
  'test',
  'www',
  'api',
  'help',
  'support',
  'portal',
  'app',
  'apps',
  'classic',
  'beta',
  'project',
  'storage',
  'dropbox',
  'atlassian',
  'available',
  'analytics',
  'team',
  'files',
  'pdf',
  'manager',
  'cdn',
  'alpha',
  'gamma'
];
/* eslint-disable no-useless-escape */
config.formio.reservedForms = [
  'submission',
  'report',
  'version',
  'tag',
  'owner',
  'exists',
  'export',
  'import',
  'clone',
  'deploy',
  'wipe',
  'role',
  'current',
  'logout',
  'form',
  'token',
  'logs',
  'classic',
  'storage\/s3',
  'storage\/dropbox',
  'storage\/azure',
  'dropbox\/auth',
  'upgrade',
  'access',
  'atlassian\/oauth\/authorize',
  'atlassian\/oauth\/finalize',
  'sqlconnector',
  'token',
  'v',
  'draft',
  'saml',
  'recaptcha',
  'manage',
  'action',
  'actionItem',
  'tag',
  'upload',
  'config.json'
];
/* eslint-enable no-useless-escape */
// If it isn't allowed as a form, it isn't allowed as a project either.
config.reservedSubdomains.concat(config.formio.reservedForms);

// Set the App settings.
var domain = getConfig('DOMAIN', 'form.io');
var port = getConfig('PORT', 80);
var host = `${protocol}://${domain}`;
var apiHost = getConfig('BASE_URL', (`${protocol}://api.${domain}`));
var formioHost = `${protocol}://${project}.${domain}`;

// Setup Google Analytics.
config.gaTid = getConfig('GOOGLE_ANALYTICS_TID', '');

if (port !== 80) {
  host += `:${port}`;
  apiHost += `:${port}`;
  formioHost += `:${port}`;
}

// Configure app server settings.
config.debug = getConfig('DEBUG', false);
config.https = (protocol === 'https');
config.protocol = protocol;
config.domain = domain;
config.formio.domain = domain;
config.formio.protocol = protocol;
config.formio.baseUrl = domain + (port !== 80 ? `:${port}` : '');
config.port = port;
config.host = host;

config.project = project;
config.plan = plan;
config.apiHost = apiHost;
config.formio.apiHost = apiHost;
config.formioHost = formioHost;
config.formio.formioHost = formioHost;
config.license = config.formio.license = getConfig('LICENSE');
config.licenseData = jwt.decode(config.license);
config.hostedPDFServer = getConfig('PDF_SERVER', '');
config.portalSSO = getConfig('PORTAL_SSO', '');
config.portalSSOLogout = getConfig('PORTAL_SSO_LOGOUT', '');

// Payeezy fields
config.payeezy = {
  keyId: getConfig('PAYEEZY_KEY_ID'),
  host: getConfig('PAYEEZY_HOST', 'api.payeeze.com'),
  endpoint: getConfig('PAYEEZY_ENDPOINT', '/v1/transactions'),
  gatewayId: getConfig('PAYEEZY_GATEWAY_ID'),
  gatewayPassword: getConfig('PAYEEZY_GATEWAY_PASSWORD'),
  hmacKey: getConfig('PAYEEZY_HMAC_KEY'),
  merchToken: getConfig('MERCHANT_TOKEN'),
};

// Using docker, support legacy linking and network links.
var mongoCollection = getConfig('MONGO_COLLECTION', 'formio');
if (getConfig('MONGO_PORT_27017_TCP_ADDR')) {
  // This is compatible with docker legacy linking.
  var mongoAddr = getConfig('MONGO_PORT_27017_TCP_ADDR', 'mongo');
  var mongoPort = getConfig('MONGO_PORT_27017_TCP_PORT', 27017);
  config.formio.mongo = `mongodb://${mongoAddr}:${mongoPort}/${mongoCollection}`;
}
else {
  if (config.docker) {
    // New docker network linking. Assumes linked with 'mongo' alias.
    config.formio.mongo = `mongodb://mongo:27017/${mongoCollection}`;
  }
  else {
    config.formio.mongo = `mongodb://localhost:27017/${mongoCollection}`;
  }
}

if (getConfig('REDIS_SERVICE')) {
  config.redis = {
    service: getConfig('REDIS_SERVICE')
  };
}
else if (getConfig('REDIS_ADDR', getConfig('REDIS_PORT_6379_TCP_ADDR'))) {
  // This is compatible with docker legacy linking.
  var addr = getConfig('REDIS_ADDR', getConfig('REDIS_PORT_6379_TCP_ADDR'));
  var redisPort = getConfig('REDIS_PORT', getConfig('REDIS_PORT_6379_TCP_PORT'));
  config.redis = {
    port: redisPort,
    host: addr,
    url: `redis://${addr}:${redisPort}`
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

  debug.config(`Using default Redis connection string (${config.redis.url}) - to disable Redis, please set REDIS_SERVICE=false`);
}

if (getConfig('REDIS_USE_SSL')) {
  config.redis.useSSL = true;
}

if (getConfig('REDIS_PASS')) {
  config.redis.password = getConfig('REDIS_PASS');
}

if (getConfig('MONGO')) {
  config.formio.mongo = getConfig('MONGO');
}
// For reverse compatibility....
else if (getConfig('MONGO1')) {
  config.formio.mongo = getConfig('MONGO1');
}

if (getConfig('MONGO_SA')) {
  config.formio.mongoSA = getConfig('MONGO_SA');
}

if (getConfig('MONGO_CONFIG')) {
  config.formio.mongoConfig = getConfig('MONGO_CONFIG');
}

// This secret is used to encrypt certain DB fields at rest in the mongo database
config.formio.mongoSecret = getConfig('DB_SECRET', 'abc123');
config.formio.mongoSecretOld = getConfig('DB_SECRET_OLD', false);

// TODO: Need a better way of setting the formio specific configurations.
if (getConfig('SENDGRID_USERNAME')) {
  config.formio.email = {};
  config.formio.email.type = 'sendgrid';
  config.formio.email.username = getConfig('SENDGRID_USERNAME');
  config.formio.email.password = getConfig('SENDGRID_PASSWORD');
}

config.formio.dropbox = {};
config.formio.dropbox.clientId = getConfig('DROPBOX_CLIENTID', '');
config.formio.dropbox.clientSecret = getConfig('DROPBOX_CLIENTSECRET', '');

// Add the JWT data.
config.formio.jwt = {};
config.formio.jwt.secret = getConfig('JWT_SECRET', 'abc123');
config.formio.jwt.expireTime = getConfig('JWT_EXPIRE_TIME', 240);
config.remoteSecret = getConfig('PORTAL_SECRET', '');

// Access endpoint configuration
config.filterAccess = getConfig('FILTER_ACCESS', true);
if (typeof config.filterAccess === 'string') {
  config.filterAccess = (config.filterAccess.toLowerCase() === 'true');
}

// Adding configuration for external workers.
config.templateService = getConfig('TEMPLATE_SERVICE', '');

// Logging config.
config.jslogger = getConfig('JS_LOGGER');
config.logging = {
  console: getConfig('LOGGING_CONSOLE', true),
  formio: getConfig('LOGGING_FORMIO', false)
};

// Allow the config to be displayed when debugged.
var sanitized = _.clone(config, true);
sanitized = _.pick(sanitized, [
  'https', 'domain', 'port', 'host', 'project', 'plan', 'formioHost', 'apiHost', 'debug', 'redis', 'docker'
]);
sanitized.formio = _.pick(_.clone(config.formio), ['domain', 'schema', 'mongo']);

config.maxBodySize = getConfig('MAX_BODY_SIZE', '16mb');

// Only output sanitized data.
debug.config(sanitized);
module.exports = config;
