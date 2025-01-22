'use strict';
const debug = require('debug')('formio:saml');

module.exports = function(reader = {}, options = {multipleCerts: false}) {
  const {identifierFormat, identityProviderUrl, logoutUrl, signingCerts} = reader;

  const config = {
    identityProviderUrl,
    entryPoint: identityProviderUrl,
    logoutUrl,
    cert: (!options.multipleCerts) ? [].concat(signingCerts).pop() : signingCerts,
    identifierFormat
  };

  debug('Extracted configuration', config);

  return config;
};
