'use strict';
const _ = require('lodash');
const request = require('request-promise-native');
const FormioUtils = require('formiojs/utils').default;

module.exports = (app) => {
  const before = function(component, path, validation, req, res, next) {
    // Only perform before validation has occurred.
    if (!validation) {
      return next();
    }

    // If there is no body, don't continue.
    if (!req.body.data) {
      return next();
    }
    // If not set to trigger on server, skip.
    if (!_.get(component, 'trigger.server', false)) {
      return next();
    }

    let requestHeaders = {};
    const token = app.formio.formio.util.getRequestValue(req, 'x-jwt-token');
    switch (component.dataSrc || 'url') {
      case 'url':
        // Add the request headers if forward headers is enabled.
        if (component.fetch && component.fetch.forwardHeaders) {
          requestHeaders = _.clone(req.headers);

          // Delete headers that shouldn't be forwarded.
          delete requestHeaders['host'];
          delete requestHeaders['content-length'];
          delete requestHeaders['content-type'];
          delete requestHeaders['connection'];
          delete requestHeaders['cache-control'];
        }

        // Add additional information.
        requestHeaders['Accept'] = '*/*';
        requestHeaders['user-agent'] = 'Form.io DataSource Component';

        // Set custom headers.
        if (component.fetch && component.fetch.headers) {
          _.each(component.fetch.headers, (header) => {
            if (header.key) {
              requestHeaders[header.key] = header.value;
            }
          });
        }

        // Set form.io authentication.
        if (component.fetch && component.fetch.authenticate && token) {
          requestHeaders['x-jwt-token'] = token;
        }

        request({
          uri: FormioUtils.interpolate(_.get(component, 'fetch.url'), {data: req.body.data}),
          method: _.get(component, 'fetch.method', 'get').toUpperCase(),
          headers: requestHeaders,
          json: true,
        })
          .then((value) => {
            if (value) {
              _.set(req.body, `data.${path}`, value);
            }
            return next();
          });
        break;
      case 'custom':
        // TODO: Implement custom async code?
        return next();
      default:
        return next();
    }
  };

  return {
    beforePut: before,
    beforePost: before
  };
};
