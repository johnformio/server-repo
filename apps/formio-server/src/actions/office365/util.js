'use strict';

var _ = require('lodash');
var adal = require('adal-node');
var uuid = require('uuid');
var AuthenticationContext = adal.AuthenticationContext;
var request = require('request');
var Q = require('q');
var qRequest = Q.denodeify(request);
module.exports = function(router) {
  return {
    /**
     * The baseUrl for Office 365 API.
     */
    baseUrl: 'https://outlook.office365.com',

    /**
     * Execute a request to Office 365 API.
     * @param router
     * @param req
     * @param res
     * @param resource
     * @param type
     * @param payload
     * @returns {Promise.<T>|*}
     */
    request: function(router, req, res, resource, type, authType, payload) {
      // Store the current resource.
      var currentResource = res.resource;

      // Connect to Office 365.
      var connectPromise;
      if (authType === 'application') {
        connectPromise = this.connectWithCertificate(router, req);
      }
      else {
        connectPromise = this.connectWithOAuth(router, req, res);
      }
      return connectPromise.then(function(connection) {
        // The URL to request.
        var url = this.baseUrl + "/api/v1.0/users('" + connection.settings.office365.email + "')/" + resource;
        var externalId = '';
        var method = 'POST';

        // Handle PUT and DELETE methods.
        if (req.method !== 'POST') {
          // Get the externalId for this resource.
          externalId = _.result(_.find(currentResource.item.externalIds, {type: type}), 'id');

          // Return if there is no external Id to update.
          if (!externalId) {
            return;
          }

          // Add to the url.
          url += "('" + externalId + "')";

          // Set the method.
          method = (req.method === 'PUT') ? 'PATCH' : 'DELETE';
        }

        // Perform the request.
        qRequest({
          url: url,
          method: method,
          json: true,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + connection.accessToken,
            'User-Agent': 'form.io/1.0',
            'client-request-id': uuid.v4(),
            'return-client-request-id': true,
            'Date': (new Date()).toUTCString()
          },
          body: payload
        })
        .spread(function(response, body) {
          // Make sure we have a body.
          if (!body) {
            throw new Error('No response from Office 365');
          }

          // Reject if the body says we have an error.
          if (body.error) {
            throw body.error;
          }

          // Only add an externalId if none is provided.
          if ((req.method === 'POST') && !externalId && body.Id) {
            // Update the resource with the external Id.
            return router.formio.resources.submission.model.update({
              _id: currentResource.item._id
            }, {
              $push: {
                externalIds: {
                  type: type,
                  id: body.Id
                }
              }
            });
          }
        });
      }.bind(this));
    },

    /**
     * Connect to Office 365 with client certificate and provide a token.
     *
     * @param router
     * @param req
     * @returns {*}
     */
    connectWithCertificate: function(router, req) {
      if (req.o365) {
        return req.o365;
      }

      req.o365 = Q.ninvoke(router.formio.hook, 'settings', req)
      .then(function(settings) {
        if (!settings) {
          throw 'No settings found.';
        }
        if (
          !settings.office365 ||
          !settings.office365.tenant ||
          !settings.office365.clientId ||
          !settings.office365.cert ||
          !settings.office365.thumbprint
        ) {
          throw 'Office 365 Not configured.';
        }

        // Create the AuthenticationContext.
        var context = new AuthenticationContext('https://login.windows.net/' + settings.office365.tenant);

          // Authenticate to Office 365.
        return Q.ninvoke(context, 'acquireTokenWithClientCertificate',
          this.baseUrl + '/',
          settings.office365.clientId,
          settings.office365.cert,
          settings.office365.thumbprint
        )
        .then(function(result) {
          return {
            settings: settings,
            accessToken: result.accessToken
          };
        });
      }.bind(this));

      return req.o365;
    },

    /**
     * Get current user's oauth access token
     *
     * @param router
     * @param req
     * @param res
     * @returns {*}
     */
    connectWithOAuth: function(router, req, res) {
      var token = req.token;
      if (!token) {
        return Q.reject('Must be logged in to connect with Office 365 via OAuth.');
      }
      if (req.o365) {
        return req.o365;
      }

      req.o365 = Q.all([
        router.formio.oauth.getUserToken(req, res, 'office365', token.user._id),
        Q.ninvoke(router.formio.hook, 'settings', req)
      ])
      .spread(function(accessToken, settings) {
        return {
          accessToken: accessToken,
          settings: settings
        };
      })
      .catch(function(err) {
        /* eslint-disable no-console */
        console.error(err);
        /* eslint-enable no-console */
        throw err;
      });

      return req.o365;
    },

    /**
     * Parse an address from Google Maps to Office 365.
     * @param value
     * @returns {*}
     */
    getAddress: function(value) {
      var address = {};
      if (!value || !value.address_components) {
        return {};
      }

      _.each(value.address_components, function(component) {
        _.each(component.types, function(type) {
          address[type] = component;
        });
      });

      var streetName = address.street_number ? (address.street_number.long_name + ' ') : '';
      streetName += address.route ? address.route.short_name : '';

      return {
        Street: streetName,
        City: address.locality ? address.locality.long_name : '',
        State: address.administrative_area_level_1 ? address.administrative_area_level_1.long_name : '',
        CountryOrRegion: address.country ? address.country.long_name : '',
        PostalCode: address.postal_code ? address.postal_code.long_name : ''
      };
    },

    /**
     * Parse an array of parameters.
     *
     * @param array
     * @param params
     * @returns {*}
     */
    getArray: function(array, params) {
      return router.formio.nunjucks.renderObj(array, params);
    },

    /**
     * Parse GPS coordinates.
     *
     * @param value
     * @returns {*}
     */
    getCoordinates: function(value) {
      if (!value || !value.geometry || !value.geometry.location) {
        return {};
      }

      return {
        Latitude: value.geometry.location.lat,
        Longitude: value.geometry.location.lng
      };
    },

    /**
     * Parse a location.
     *
     * @param value
     * @returns {{DisplayName: *, Address: *, Coordinates: *}}
     */
    getLocation: function(value) {
      if (!value) {
        return {};
      }

      return {
        DisplayName: value.formatted_address,
        Address: this.getAddress(value),
        Coordinates: this.getCoordinates(value)
      };
    },

    /**
     * Return an email property.
     *
     * @param value
     * @returns {{Name: *, Address: *}}
     */
    getEmail: function(value) {
      return {
        Name: value,
        Address: value
      };
    },

    /**
     * Return a recipient.
     *
     * @param value
     * @returns {{EmailAddress: *}}
     */
    getRecipient: function(value, required) {
      var recipient = {
        EmailAddress: this.getEmail(value)
      };

      if (required) {
        recipient.type = 'Required';
      }

      return recipient;
    },

    /**
     * Get recipients of an email.
     *
     * @param value
     * @param params
     * @returns {Array}
     */
    getRecipientsObject: function(emails, required) {
      var recipients = [];
      _.each(emails, function(email) {
        recipients.push(this.getRecipient(email, required));
      }.bind(this));
      return recipients;
    },

    /**
     * Parses an attendees array.
     *
     * @param value
     * @param params
     * @returns {Array}
     */
    getRecipients: function(value, params) {
      return this.getRecipientsObject(router.formio.nunjucks.renderObj(value, params), true);
    },

    /**
     * Returns a content body object provided the HTML body.
     *
     * @param body The HTML body of the content.
     * @returns {{ContentType: string, Content: *}}
     */
    getBodyObject: function(body) {
      return {
        ContentType: 'HTML',
        Content: body
      };
    },

    /**
     * Returns the body object provided the non compiled HTML body.
     *
     * @param value
     * @param params
     * @returns {*|{ContentType, Content}|{ContentType: string, Content: *}}
     */
    getBody: function(value, params) {
      return this.getBodyObject(router.formio.nunjucks.render(value, params));
    }
  };
};
