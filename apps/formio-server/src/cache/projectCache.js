'use strict';

const NodeCache = require('node-cache');
const ncache = new NodeCache();
const CACHE_TIME =  process.env.FORMIO_HOSTED ? 0 : process.env.CACHE_TIME || 15 * 60;

module.exports = function(server) {
    const formio = server.formio;

    return {
        load(query, cb) {
            if (!cb) {
                cb = (err, result) => new Promise((resolve, reject) => (err ? reject(err) : resolve(result)));
            }
            const id = query._id;
            if (id && ncache.get(id.toString())) {
                const project = {
                    ...JSON.parse(ncache.get(id.toString())),
                    toObject() {
                        return this;
                    }
                };
                return cb(null, project);
            }
            return formio.resources.project.model.findOne(query).then(function(result) {
                if (result) {
                  ncache.set(result._id.toString(), JSON.stringify(result), CACHE_TIME);
                }
                return cb(null, result);
            }).catch(err => cb(err, null));
        },

        clear(id, cb) {
            if (!cb) {
                cb = (err, result) => new Promise((resolve, reject) => (err ? reject(err) : resolve(result)));
            }
            ncache.del(id);
        }
    };
};
