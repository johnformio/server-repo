'use strict';

const fetch = require('@formio/node-fetch-http-proxy');
const _ = require('lodash');

module.exports = (config) => {
    if (config.service) {
        const parts = config.service.split('?');
        config.service = _.trimEnd(parts[0], '/');
        config.query = (parts.length > 1) ? (`?${parts[1]}`) : '';
    }

    return {
        active: Boolean(config.service),
        callPromise(method, path, body, next) {
            return new Promise((resolve, reject) => {
                this.call(method, path, body, (err, result) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve(result);
                });
            });
        },
        call(method, path, body, next) {
            fetch(config.service + path + config.query, {
                method: method.toUpperCase(),
                body: JSON.stringify(body),
                timeout: 30000,
                rejectUnauthorized: false,
            })
            .then(resp => resp.json())
            .then((result) => {
                if (!next) {
                    return null;
                }
                if (!result) {
                    return next('Invalid response.');
                }
                return next(null, result);
            })
            .catch(err => {
                if (next) {
                    return next(err);
                }
            });
        }
    };
};
