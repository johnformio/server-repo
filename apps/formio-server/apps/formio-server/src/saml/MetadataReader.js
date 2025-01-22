'use strict';
const assert = require('assert');
const debug = require('debug')('formio:saml');
const _ = require('lodash');
const {DOMParser} = require('@xmldom/xmldom');
const xpath = require('xpath');

class MetadataReader {
  constructor(metadata, options = {}) {
    assert.equal(typeof metadata, 'string', 'metadata must be an XML string');

    this.doc = new DOMParser().parseFromString(metadata);

    this.select = xpath.useNamespaces({
      md: 'urn:oasis:names:tc:SAML:2.0:metadata',
      claim: 'urn:oasis:names:tc:SAML:2.0:assertion',
      sig: 'http://www.w3.org/2000/09/xmldsig#'
    });

    this.options = _.merge({}, this.defaultOptions, options);
  }

  get defaultOptions() {
    return {
        authnRequestBinding: 'HTTP-Redirect',
        throwExceptions: false
      };
  }

  query(query) {
    try {
      return this.select(query, this.doc);
    }
    catch (err) {
      debug(`Could not read xpath query "${query}"`, err);
      throw err;
    }
  }

  get identifierFormat() {
    try {
      return this.query('//md:IDPSSODescriptor/md:NameIDFormat/text()')[0].nodeValue;
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get identityProviderUrl() {
    try {
      // Get all of the SingleSignOnService elements in the XML, sort them by the index (if provided)
      const singleSignOnServiceElements = _.sortBy(this.query('//md:IDPSSODescriptor/md:SingleSignOnService'), (singleSignOnServiceElement) => {
        const indexAttribute = _.find(singleSignOnServiceElement.attributes, {name: 'index'});

        if (indexAttribute) {
          return indexAttribute.value;
        }

        return 0;
      });

      // Find the specified authentication binding, if not available default to the first binding in the list
      const singleSignOnServiceElement = _.find(singleSignOnServiceElements, (element) => {
        return _.find(element.attributes, {
          value: `urn:oasis:names:tc:SAML:2.0:bindings:${this.options.authnRequestBinding}`
        });
      }) || singleSignOnServiceElements[0];

      // Return the location
      return _.find(singleSignOnServiceElement.attributes, {name: 'Location'}).value;
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get logoutUrl() {
    try {
      // Get all of the SingleLogoutService elements in the XML, sort them by the index (if provided)
      const singleLogoutServiceElements = _.sortBy(this.query('//md:IDPSSODescriptor/md:SingleLogoutService'), (singleLogoutServiceElement) => {
        const indexAttribute = _.find(singleLogoutServiceElement.attributes, {name: 'index'});

        if (indexAttribute) {
          return indexAttribute.value;
        }

        return 0;
      });

      // Find the specified authentication binding, if not available default to the first binding in the list
      const singleLogoutServiceElement = _.find(singleLogoutServiceElements, (element) => {
        return _.find(element.attributes, {
          value: `urn:oasis:names:tc:SAML:2.0:bindings:${this.options.authnRequestBinding}`
        });
      }) || singleLogoutServiceElements[0];

      // Return the location
      return _.find(singleLogoutServiceElement.attributes, {name: 'Location'}).value;
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get encryptionCerts() {
    try {
      const certs = this.query('//md:IDPSSODescriptor/md:KeyDescriptor[@use="encryption" or not(@use)]/sig:KeyInfo/sig:X509Data/sig:X509Certificate');
      if (!certs) {
        throw new Error('No encryption certificate found');
      }

      return certs.map((node) => node.firstChild.data.replace(/[\r\n\t\s]/gm, ''));
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get encryptionCert() {
    try {
      return this.encryptionCerts[0];
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get signingCerts() {
    try {
      const certs = this.query('//md:IDPSSODescriptor/md:KeyDescriptor[@use="signing" or not(@use)]/sig:KeyInfo/sig:X509Data/sig:X509Certificate');
      if (!certs) {
        throw new Error('No signing certificate found');
      }

      return certs.map((node) => node.firstChild.data.replace(/[\r\n\t\s]/gm, ''));
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get signingCert() {
    try {
      return this.signingCerts[0];
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }

  get claimSchema() {
    try {
      return this.query('//md:IDPSSODescriptor/claim:Attribute/@Name')
        .reduce((claims, node) => {
          try {
            const name = node.value;
            const description = this.query(`//md:IDPSSODescriptor/claim:Attribute[@Name="${name}"]/@FriendlyName`)[0].value;
            const camelized = _.camelCase(description);
            claims[node.value] = {name, description, camelCase: camelized};
          }
          catch (err) {
            if (this.options.throwExceptions) {
              throw err;
            }
          }
          return claims;
        }, {});
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      return {};
    }
  }

  get entityId() {
    try {
      return this.query('//md:EntityDescriptor/@entityID')[0].value.replace(/[\r\n\t\s]/gm, '');
    }
    catch (err) {
      if (this.options.throwExceptions) {
        throw err;
      }
      else {
        return undefined;
      }
    }
  }
}

module.exports = MetadataReader;
