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
        files.forEach((file) => {
          const fullPath = path.join(secretDir, file);
          const key = file;
          const data = fs.readFileSync(fullPath, 'utf8').toString().trim();

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

// We need this for backwards compatibility, e.g. legacy customers passing string cert/key values
const processFilePathOrValue = (filePathOrValue) => {
  try {
    // Attempt to read the file if it exists.
    return fs.readFileSync(filePathOrValue, 'utf-8');
  }
  catch (err) {
    // File doesn't exist or something went wrong, attempt to utilize as a string/boolean value
    return filePathOrValue;
  }
};

var config = {formio: {}};
var protocol = getConfig('PROTOCOL', 'https');
var project = getConfig('PROJECT', 'formio');
var plan = getConfig('PROJECT_PLAN', 'commercial');

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
  'storage\/gdrive',
  'dropbox\/auth',
  'gdrive\/auth',
  'upgrade',
  'access',
  'atlassian\/oauth\/authorize',
  'atlassian\/oauth\/finalize',
  'sqlconnector',
  'token',
  'v',
  'draft',
  'saml',
  'oauth2',
  'recaptcha',
  'manage',
  'action',
  'actionItem',
  'tag',
  'upload',
  'pdf-proxy',
  'config.json',
  'portal-check',
  '2fa\/generate',
  '2fa\/represent',
  '2fa\/turn-off',
  '2fa\/turn-on',
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
  host += (host.indexOf(':') === -1) ? `:${port}` : '';
  apiHost += (apiHost.indexOf(':') === -1) ? `:${port}` : '';
  formioHost += (formioHost.indexOf(':') === -1) ? `:${port}` : '';
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

// Configure SSL settings as either file paths or string values
config.sslEnabled = getConfig('ENABLE_SSL', false);
const sslKey = getConfig('SSL_KEY', false);
const sslCert = getConfig('SSL_CERT', false);
config.sslKey = sslKey ? processFilePathOrValue(sslKey) : false;
config.sslCert = sslCert ? processFilePathOrValue(sslCert) : false;

config.project = project;
config.plan = plan;
config.baseUrl = getConfig('BASE_URL', '');
config.apiHost = apiHost;
config.formio.apiHost = apiHost;
config.formioHost = formioHost;
config.formio.formioHost = formioHost;
config.licenseKey = getConfig('LICENSE_KEY');
config.licenseRemote = getConfig('LICENSE_REMOTE', false);
config.portalSSO = getConfig('PORTAL_SSO', '');
config.ssoTeams = Boolean(getConfig('SSO_TEAMS', false) || config.portalSSO);
config.portalSSOLogout = getConfig('PORTAL_SSO_LOGOUT', '');
config.verboseHealth = getConfig('VERBOSE_HEALTH');
config.vpat = Boolean(getConfig('VPAT', false));
config.twoFactorAuthAppName = getConfig('TWO_FACTOR_AUTHENTICATION_APP_NAME', 'Form.io');
config.licenseServer = getConfig('LICENSE_SERVER', 'https://license.form.io');
config.formio.defaultEmailSource= getConfig('DEFAULT_EMAIL_SOURCE', 'no-reply@example.com');
config.pdfServer = getConfig('PDF_SERVER') || getConfig('FORMIO_FILES_SERVER');
config.pdfProject = getConfig('FORMIO_PDF_PROJECT', 'https://pdf.form.io');
config.pdfProjectApiKey = getConfig('FORMIO_PDF_APIKEY');

config.enableOauthM2M = getConfig('OAUTH_M2M_ENABLED', false);
config.formio.hosted = false;

config.whitelabel = Boolean(getConfig('WHITELABEL'), false);
config.onlyPrimaryWriteAccess = Boolean(getConfig('ONLY_PRIMARY_WRITE_ACCESS', false));
config.AccessControlMaxAge = getConfig('ACCESS_CONTROL_MAX_AGE', 600);
config.enableRestrictions = getConfig('ENABLE_RESTRICTIONS', false);

config.formio.vmTimeout = getConfig('FORMIO_VM_TIMEOUT', 500);

const getMaxOldSpace = () => {
  const nodeOptions = getConfig('NODE_OPTIONS', '');
  const execArgv = process.execArgv || [];
  const argv = process.argv || [];

  const ENV_NAME = '--max_old_space_size=';

  let space = '';
  const regexp = /(?<=--max_old_space_size=)\d*/g;

  try {
    if (nodeOptions && nodeOptions.indexOf(ENV_NAME) !== -1) {
      space = (nodeOptions.match(regexp) || [])[0];
    }
    else if (
      execArgv
      && _.isArray(execArgv)
      && execArgv.some((arg) => arg.indexOf(ENV_NAME) !== -1)
      ) {
      const [spaceArg] = execArgv.filter((arg) => arg.indexOf(ENV_NAME) !== -1);
      space = (spaceArg.match(regexp) || [])[0];
    }
    else if (
      argv
      && _.isArray(argv)
      && argv.some((arg) => arg.indexOf(ENV_NAME) !== -1)
      ) {
      const [spaceArg] = argv.filter((arg) => arg.indexOf(ENV_NAME) !== -1);
      space = (spaceArg.match(regexp) || [])[0];
    }
    else {
      space = null;
    }
  }
  // eslint-disable-next-line no-empty
  catch (error) {}

  return space;
};

config.formio.maxOldSpace = getMaxOldSpace();

config.enableOauthM2M = getConfig('OAUTH_M2M_ENABLED', false);

// Configure Fortis settings.
config.fortis = {
  userId: getConfig('FORTIS_USER_ID'),
  userAPIKey: getConfig('FORTIS_USER_API_KEY'),
  endpoint: getConfig('FORTIS_ENDPOINT', 'https://api.sandbox.fortis.tech/v1/transactions/cc/auth-only/keyed'),
  developerId: getConfig('FORTIS_DEV_ID')
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

if (getConfig('MONGO_CA')) {
  config.formio.mongoCA = getConfig('MONGO_CA');
}

if (getConfig('MONGO_SSL')) {
  config.formio.mongoSSL = getConfig('MONGO_SSL');
}

if (getConfig('MONGO_SSL_VALIDATE')) {
  config.formio.mongoSSLValidate = getConfig('MONGO_SSL_VALIDATE');
}

if (getConfig('MONGO_SSL_PASSWORD')) {
  config.formio.mongoSSLPassword = getConfig('MONGO_SSL_PASSWORD');
}

if (getConfig('MONGO_CONFIG')) {
  config.formio.mongoConfig = getConfig('MONGO_CONFIG');
}

// This secret is used to encrypt certain DB fields at rest in the mongo database
config.formio.mongoSecret = getConfig('DB_SECRET', 'abc123');
config.formio.mongoSecretOld = getConfig('DB_SECRET_OLD', false);

// TODO: Need a better way of setting the formio specific configurations.
if (getConfig('SENDGRID_PASSWORD')) {
  config.formio.email = {};
  config.formio.email.type = 'sendgrid';
  config.formio.email.username = getConfig('SENDGRID_USERNAME');
  config.formio.email.password = getConfig('SENDGRID_PASSWORD');
}

config.formio.dropbox = {};
config.formio.dropbox.clientId = getConfig('DROPBOX_CLIENTID', '');
config.formio.dropbox.clientSecret = getConfig('DROPBOX_CLIENTSECRET', '');

// Session settings.
config.formio.session = {
  expireTime: getConfig('SESSION_EXPIRE_TIME', ''),
};

// Add the JWT data.
config.formio.jwt = {};
config.formio.jwt.secret = getConfig('JWT_SECRET', 'abc123');
config.formio.jwt.expireTime = getConfig('JWT_EXPIRE_TIME', 240);
config.remoteSecret = getConfig('PORTAL_SECRET', '');

config.formio.audit = !getConfig('NOAUDITLOG', false);

// Access endpoint configuration
config.filterAccess = getConfig('FILTER_ACCESS', true);
if (typeof config.filterAccess === 'string') {
  config.filterAccess = (config.filterAccess.toLowerCase() === 'true');
}

// Adding configuration for external workers.
config.templateService = getConfig('TEMPLATE_SERVICE', '');

// Logging config.
config.jslogger = getConfig('JS_LOGGER');

// Allow the config to be displayed when debugged.
var sanitized = _.clone(config, true);

const debugConfigVars = getConfig(
  'DEBUG_CONFIG_VARS', 'https,domain,port,host,project,plan,formioHost,apiHost,debug,docker',
).split(',') || [];
sanitized = _.pick(sanitized, debugConfigVars);

const debugFormioConfigVars = getConfig('DEBUG_CONFIG_FORMIO_VARS', 'domain,schema').split(',') || [];
sanitized.formio = _.pick(_.clone(config.formio), debugFormioConfigVars);

config.maxBodySize = getConfig('MAX_BODY_SIZE', '25mb');

// Add the getConfig function to the config object so we can get at secrets/environment variables that we don't
// necessarily want to store in the global-ish config object (mainly we just want to support docker secrets along
// with process.env)
config.getConfig = getConfig;

// Only output sanitized data.
debug.config(sanitized);
module.exports = config;
