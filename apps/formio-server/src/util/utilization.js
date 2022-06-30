'use strict';
const fetch = require('formio/src/util/fetch');
const _ = require('lodash');
const {match} = require("path-to-regexp");
const licenseServer = process.env.LICENSE_SERVER || 'https://license.form.io';
const NodeCache = require('node-cache');
const plans = require('../plans/plans');
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

const getProjectContext = (req, isNew = false) => {
  const type = isNew ? _.get(req, 'body.type', 'project') : _.get(req, 'currentProject.type', req.body.type || 'project');
  switch (type) {
    case 'tenant':
      return {
        type: 'tenant',
        projectId: req.primaryProject ? req.primaryProject._id : ((req.body && req.body.project) ? req.body.project : 'new'),
        tenantId: req.currentProject && !isNew ? req.currentProject._id : 'new',
        title: req.currentProject && !isNew ? req.currentProject.title : req.body.title,
        name: req.currentProject && !isNew ? req.currentProject.name : req.body.name,
        remote: req.currentProject && !isNew ? !!req.currentProject.remote : false,
        projectType: req.currentProject && !isNew ? req.currentProject.type : req.body.type,
      };
    case 'stage':
      return {
        type: 'stage',
        projectId: req.primaryProject ? req.primaryProject._id : ((req.body && req.body.project) ? req.body.project : 'new'),
        tenantId: (req.parentProject && req.parentProject._id.toString() !== req.primaryProject._id.toString()) ? req.parentProject._id : 'none',
        stageId: req.currentProject && !isNew ? req.currentProject._id : 'new',
        title: req.currentProject && !isNew ? req.currentProject.title : req.body.title,
        name: req.currentProject && !isNew ? req.currentProject.name : req.body.name,
        remote: req.currentProject && !isNew ? !!req.currentProject.remote : false,
        projectType: req.currentProject && !isNew ? req.currentProject.type : req.body.type,
        isDefaultAuthoring: (
          req.currentProject && !isNew
            ? _.get(req.currentProject, 'config.defaultStageName', '')
            : _.get(req, 'body.config.defaultStageName', '')
        ) === 'authoring',
      };
    case 'project':
    default:
      return {
        type: 'project',
        projectId: req.currentProject ? req.currentProject._id : 'new',
        title: req.currentProject ? req.currentProject.title : req.body.title,
        name: req.currentProject ? req.currentProject.name : req.body.name,
        remote: req.currentProject ? !!req.currentProject.remote : false,
        projectType: req.currentProject ? req.currentProject.type : req.body.type,
      };
  }
};

async function utilizationSync(app, cacheKey, body, action = '') {
  return await utilization(app, cacheKey, body, action, true, true);
}

function utilization(app, cacheKey, body, action = '', clear = false, sync = false) {
  if (licenseConfig.remote) {
    return sync ? Promise.resolve(null) : null;
  }

  // Add the action to the cacheKey.
  if (action) {
    cacheKey += action.replace(/\//g, ':');
  }

  const qs = {terms: 1, keys: 1};

  // Incremenet the number of requests since last request.
  const numRequests = requestCount.get(cacheKey);
  body.numRequests = numRequests ? (numRequests + 1) : 1;
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

  const hosted = process.env.FORMIO_HOSTED;
  const onPremiseScopes = ['apiServer', 'pdfServer', 'project', 'tenant', 'stage', 'formManager', 'accessibility', 'submissionServer'];

  // If on premise and not scoped for on premise, skip check.
  if (!hosted && !onPremiseScopes.includes(body.type)) {
    return sync ? Promise.resolve(body) : body;
  }

  // Enable turning off req
  if (process.env.SKIP_FORM_LICENSING && ['formRequest', 'submissionRequest'].includes(body.type)) {
    return sync ? Promise.resolve(body) : body;
  }

  if (!hosted) {
    // Tell server to return a hash.
    qs.hash = 1;
    // Timestamp required for hash
    body.timestamp = Date.now() - 6000;
  }

  debug(`Licence Check: ${cacheKey}`);
  cachedRequest = fetch(`${licenseServer}/utilization${action}`, {
    method: 'post',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
    timeout: 30000,
    qs,
    rejectUnauthorized: false,
  }).then(async (response) => {
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
    if (utilization.licenseServerError) {
      return utilization;
    }
    else {
      app.utilizationCheckSucceed();
    }
    if (!utilization.error && !hosted && utilization.hash !== md5(base64(body))) {
      utilization = {error: new Error('Invalid response')};
    }
    lastUtilizationTime = Date.now();
    responseCache.set(cacheKey, utilization);
    return utilization;
  }).catch((err) => {
    // License server is down or request timeout exceed
    if (err.code === 'ECONNREFUSED' || err.type === 'aborted') {
      app.utilizationCheckFailed();
      clearCache(cacheKey);
      return {licenseServerError: true, ...body};
    }
    const response = {error: err};
    responseCache.set(cacheKey, response);
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

async function getLicense(formio, licenseKey) {
  return await formio.resources.submission.model.findOne({
    ...await getLicenseInfo(formio),
    'data.licenseKeys.key': licenseKey,
  });
}

async function setLicensePlan(formio, licenseKey, planName, additional = {}, addScopes = []) {
  if (!(Object.keys(plans).includes(planName))) {
    throw new Error('Invalid Plan');
  }

  const plan = new plans[planName]();

  const license = await getLicense(formio, licenseKey);
  if (!license) {
    throw new Error('No license found');
  }
  const {
    licenseName,
    user,
    company,
    comments,
    location,
  } = license.toObject().data;

  const data = {
    ...plan.getPlan(licenseKey),
    ...additional,
    licenseName,
    user,
    company,
    comments,
    location,
  };
  _.set(data, 'licenseKeys[0].scope', _.uniq([..._.get(data, 'licenseKeys[0].scope'), ...addScopes]));
  license.data = data;
  await license.save();
  try {
    await clearLicenseCache(license._id);
  }
  catch (err) {
    // Ignore error. This is only trying to clear cache.
  }
}

async function clearLicenseCache(licenseId) {
  if (licenseConfig.remote) {
    return Promise.resolve();
  }
  await fetch(`${licenseServer}/license/${licenseId}/clear`, {
    method: 'post',
    headers: {'content-type': 'application/json'},
    timeout: 30000,
    rejectUnauthorized: false,
  })
    .then((response) => response.ok ? response.json() : null);
}

function checkLastUtilizationTime(req) {
  const hosted = process.env.FORMIO_HOSTED;
  if (!hosted) {
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
  }
  return false;
}

async function getNumberOfExistingProjects(formio) {
  return await formio.resources.project.model.count({deleted: {'$eq': null}, project: null}) - 1;
}

function getRemoteLicenseData(app) {
  return ({
    terms: _.get(app, 'license.terms', false),
    exp: _.get(app, 'license.exp', false),
  });
}

async function remoteUtilization(app, flag) {
  const licenseData = getRemoteLicenseData(app);
  const numberOfProjects = await getNumberOfExistingProjects(app.formio.formio);
  if (flag && flag.strict && licenseData.terms.projectsNumberLimit && numberOfProjects >= licenseData.terms.projectsNumberLimit) {
    return {error: new Error(`Exceeded the allowed number of projects. Max number of your projects is ${licenseData.terms.projectsNumberLimit}. You have ${numberOfProjects} projects.`)};
  }
 else if (licenseData.terms.projectsNumberLimit && numberOfProjects > licenseData.terms.projectsNumberLimit) {
    return {error: new Error(`Exceeded the allowed number of projects. Max number of your projects is ${licenseData.terms.projectsNumberLimit}. You have ${numberOfProjects} projects.`)};
  }
  if (licenseData.exp && licenseData.exp <= Date.now()) {
    return {error: new Error('License is expired.')};
  }
}

module.exports = {
  licenseConfig,
  utilizationSync,
  utilization,
  clearCache,
  createLicense,
  getProjectContext,
  getLicenseKey,
  getLicense,
  setLicensePlan,
  checkLastUtilizationTime,
  getNumberOfExistingProjects,
  remoteUtilization,
};
