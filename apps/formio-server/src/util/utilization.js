'use strict';
const fetch = require('@formio/node-fetch-http-proxy');
const _ = require('lodash');
const {match} = require("path-to-regexp");
const licenseServer = process.env.LICENSE_SERVER || 'https://license.form.io';
const NodeCache = require('node-cache');
const debug = require('debug')('formio:license');

const requestCache = new NodeCache();
const requestCount = new NodeCache();
const responseCache = new NodeCache();
const licenseConfig = {remote: false};
let lastUtilizationTime = 0;

// Cache responses for 15 minutes
const CACHE_TIME = process.env.CACHE_TIME || 15 * 60;

const getLicenseKey = (req) => {
  if (req.licenseKey) {
    return req.licenseKey;
  }
  req.licenseKey = _.get(req, 'primaryProject.settings.licenseKey', _.get(req, 'licenseKey', process.env.LICENSE_KEY));
  return req.licenseKey;
};

function md5(str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
}

function base64(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

async function utilizationSync(app, cacheKey, body, action = '', clearCache, projectUrl) {
  return await utilization(app, cacheKey, body, action, _.isBoolean(clearCache) ? clearCache : true, true, projectUrl);
}

function utilization(app, cacheKey, body = {}, action = '', clear = false, sync = false, projectUrl = '') {
  const isHostedFMCheck = !!projectUrl && _.endsWith(cacheKey, 'formManager:hosted');
  debug(`FM Check: ${isHostedFMCheck}`);
  debug(`FM Project URL: ${projectUrl}`);
  if (!isHostedFMCheck && licenseConfig.remote) {
    return sync ? Promise.resolve(null) : null;
  }
  // Add the action to the cacheKey.
  if (action) {
    cacheKey += action.replace(/\//g, ':');
  }

  const qs = {terms: 1, keys: 1};

  // Incremenet the number of requests since last request.
  const numRequests = requestCount.get(cacheKey);
  requestCount.set(cacheKey, numRequests, CACHE_TIME);

  // If they wish to clear, then do that here.
  if (clear) {
    clearCache(cacheKey);
  }

  // Set the response cache if provided.
  const response = responseCache.get(cacheKey);
  if (response) {
    // If an error occurred last time, then delete here so it will try again.
    if (response.error) {
      responseCache.del(cacheKey);
    }
    return sync ? Promise.resolve(response) : response;
  }

  // If the request is currently being processed, then just return the promise.
  let cachedRequest = requestCache.get(cacheKey);
  if (cachedRequest) {
    return sync ? cachedRequest : null;
  }

  const requestOptions =  {
    timeout: 30000,
    rejectUnauthorized: false,
  };

  let licenseServerRequest = Promise.resolve();

  if (isHostedFMCheck) {
    licenseServerRequest = fetch(`${licenseServer}/check/manager?project=${projectUrl}`, {
      method: 'get',
      ...requestOptions
    });
  }
  else {
    body.numRequests = numRequests ? (numRequests + 1) : 1;
    const onPremiseScopes = ['apiServer', 'pdfServer', 'project', 'tenant', 'stage', 'remoteStage', 'formManager', 'accessibility', 'submissionServer'];

    // If on premise and not scoped for on premise, skip check.
    if (!onPremiseScopes.includes(body.type)) {
      return sync ? Promise.resolve(body) : body;
    }

    // Enable turning off req
    if (process.env.SKIP_FORM_LICENSING && ['formRequest', 'submissionRequest'].includes(body.type)) {
      return sync ? Promise.resolve(body) : body;
    }

    // Tell server to return a hash.
    qs.hash = 1;
    // Timestamp required for hash
    body.timestamp = Date.now() - 6000;

    if (body.remoteStage) {
      body.type = 'remoteStage';
    }

    licenseServerRequest = fetch(`${licenseServer}/utilization${action}`, {
      method: 'post',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(body),
      qs,
      ...requestOptions
    });
  }

  debug(`License Check: ${cacheKey}`);
  cachedRequest = licenseServerRequest.then(async (response) => {
    responseCache.del(cacheKey);
    requestCache.del(cacheKey);
    if (!response.ok) {
      const error = new Error(await response.text());
      error.statusCode = response.status;
      if (error.statusCode >= 500) {
        app.utilizationCheckFailed();
        clearCache(cacheKey);
        return {licenseServerError: true, ...body};
      }
      return {error};
    }

    return await response.json();
  }).then((utilization) => {
    if (utilization.error) {
      throw utilization.error;
    }
    else if (utilization.licenseServerError) {
      throw utilization.licenseServerError;
    }
    else {
      app.utilizationCheckSucceed();
    }
    if (!isHostedFMCheck && !utilization.error && utilization.hash !== md5(base64(body))) {
      utilization = {error: new Error('Invalid response')};
    }
    lastUtilizationTime = Date.now();
    responseCache.set(cacheKey, utilization, CACHE_TIME);
    return utilization;
  }).catch((err) => {
    debug(`Utilization Error: ${err}`);
    // License server is down or request timeout exceed
    if (err.code === 'ECONNREFUSED' || err.type === 'aborted') {
      app.utilizationCheckFailed();
      clearCache(cacheKey);
      return {licenseServerError: true, ...body};
    }
    const response = {error: err};
    responseCache.set(cacheKey, response, CACHE_TIME);
    requestCache.del(cacheKey);
    return response;
  });
  requestCache.set(cacheKey, cachedRequest, CACHE_TIME);

  // Return the promise in case they need the response.
  return sync ? cachedRequest : null;
}

function clearCache(cacheKey) {
  responseCache.del(cacheKey);
  requestCache.del(cacheKey);
  requestCount.del(cacheKey);
}

async function getLicenseInfo(formio) {
  const project = await formio.resources.project.model.findOne({
    name: 'formio'
  });

  const form = await formio.resources.form.model.findOne({
    project: project._id,
    name: 'license2',
  });

  return {
    project: project._id,
    form: form._id,
  };
}

async function createLicense(formio, req, data) {
  let owner = await formio.resources.submission.model.findOne({
    _id: req.primaryProject.owner,
  });

  owner = owner.toObject();

  return await formio.resources.submission.model.create({
    ...await getLicenseInfo(formio),
    owner: req.primaryProject.owner,
    data: {
      ...data,
      user: [
        {
          ...owner,
          data: { // Only save some data.
            email: owner.data.email,
            name: owner.data.name,
            fullName: owner.data.fullName,
          }
        }
      ]
    },
  });
}

function checkLastUtilizationTime(req) {
  // allow all requests for 12 hours without a license
  if (lastUtilizationTime + (1 * 60 * 1000) > Date.now()) {
    return true;
  }
  // allow only read data and make submissions after 12 hours without a license
  else if (req.method === 'GET' ||
    ['/project/:projectId/form/:formId/submission', '/project/:projectId/form/:formId/submission/:submissionId']
      .some((route) => match(route)(req.path))) {
    return true;
  }
  return false;
}

async function getNumberOfExistingProjects(formio, project = null) {
  const projectQuery = {deleted: null, project: null, name: {$ne: 'formio'}};
  if (
    project &&
    project.projectId &&
    formio.mongoose.Types.ObjectId.isValid(project.projectId)
  ) {
    projectQuery.type = project.type;
    if (project.tenantId === 'none' || project.tenantId === 'new') {
      projectQuery.project = formio.util.ObjectId(project.projectId);
    }
    else {
      projectQuery.project = formio.util.ObjectId(project.tenantId);
    }
  }
  return await formio.resources.project.model.count(projectQuery);
}

function getRemoteLicenseData(app) {
  return ({
    terms: _.get(app, 'license.terms', false),
    exp: _.get(app, 'license.exp', false),
  });
}

async function remoteUtilization(app, project) {
  const licenseData = getRemoteLicenseData(app);
  if (licenseData.exp && licenseData.exp <= parseInt(Date.now() / 1000)) {
    return {error: new Error('License is expired.')};
  }
  const numberOfProjects = await getNumberOfExistingProjects(app.formio.formio, project);
  let projectLimit;
  switch (project.type) {
    case 'project':
      projectLimit = licenseData.terms.projectsNumberLimit;
      break;
    case 'tenant':
      projectLimit = licenseData.terms.tenants;
      break;
    case 'stage':
      projectLimit = licenseData.terms.stages;
      break;
  }
  if (projectLimit && numberOfProjects >= projectLimit) {
    return {error: new Error(`Exceeded the allowed number of ${project.type}s. Max number of your ${project.type}s is ${projectLimit}. You have ${numberOfProjects} ${project.type}s.`)};
  }
}

module.exports = {
  licenseConfig,
  utilizationSync,
  utilization,
  clearCache,
  createLicense,
  getLicenseKey,
  checkLastUtilizationTime,
  getNumberOfExistingProjects,
  remoteUtilization,
};
