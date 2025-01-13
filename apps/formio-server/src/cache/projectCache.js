'use strict';

const NodeCache = require('node-cache');
const ncache = new NodeCache();
const CACHE_TIME =  process.env.FORMIO_HOSTED ? 0 : process.env.CACHE_TIME || 15 * 60;

module.exports = function(formio) {
    const projectCache = {
        async load(projectId, noCache) {
            if (!projectId) {
                return null;
            }
            const id = projectId.toString();
            if (!noCache && id) {
                const project = ncache.get(id);
                if (project) {
                    return JSON.parse(project);
                }
            }

            try {
              let result = await formio.resources.project.model.findOne({
                _id: formio.util.idToBson(projectId),
                deleted: {$eq: null}
              }).exec();
              if (result) {
                result = result.toObject();
                projectCache.set(result);
              }
              return result;
            }
            catch (ignoreErr) {
              // Return undefined if there is an error finding the project e.g. can't cast ObjectId etc.
              return;
            }
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
