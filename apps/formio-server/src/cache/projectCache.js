'use strict';

const NodeCache = require('node-cache');
const ncache = new NodeCache();
const CACHE_TIME =  process.env.FORMIO_HOSTED ? 0 : process.env.CACHE_TIME || 15 * 60;

module.exports = function(formio) {
    const projectCache = {
        load(projectId, cb, noCache) {
            if (!cb) {
                cb = (err, result) => new Promise((resolve, reject) => (err ? reject(err) : resolve(result)));
            }
            if (!projectId) {
                return cb(null, null);
            }
            const id = projectId.toString();
            if (!noCache && id) {
                const project = ncache.get(id);
                if (project) {
                    return cb(null, JSON.parse(project));
                }
            }
            return formio.resources.project.model.findOne({
                _id: formio.util.idToBson(projectId),
                deleted: {$eq: null}
            }).exec().then(function(result) {
                result = result.toObject();
                projectCache.set(result);
                return cb(null, result);
            }).catch(err => cb(err, null));
        },

        set(project) {
            if (project && project._id) {
                ncache.set(project._id.toString(), JSON.stringify(project), CACHE_TIME);
            }
        },

        clear(project) {
            if (project && project._id) {
                ncache.del(project._id.toString());
            }
        }
    };
    return projectCache;
};
