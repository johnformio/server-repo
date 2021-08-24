'use strict';
const fetch = require('formio/src/util/fetch');
const _ = require('lodash');
const {match} = require("path-to-regexp");
const licenseServer = process.env.LICENSE_SERVER || 'https://license.form.io';
const NodeCache = require('node-cache');
const plans = require('../plans/plans');

const cache = new NodeCache();
let lastUtilizationTime = 0;

// Cache response for 3 hours.
const CACHE_TIME = process.env.CACHE_TIME || 3 * 60 * 60;

const getLicenseKey = (req) => {
  return _.get(req, 'primaryProject.settings.licenseKey', _.get(req, 'licenseKey', process.env.LICENSE_KEY));
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
          ?  _.get(req.currentProject, 'config.defaultStageName', '')
          :  _.get(req, 'body.config.defaultStageName', '')
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

async function utilization(body, action = '', qs = {terms: 1}) {
  const hosted = process.env.FORMIO_HOSTED;
  const onPremiseScopes = ['apiServer', 'pdfServer', 'project', 'tenant', 'stage', 'formManager', 'accessibility', 'submissionServer'];

  // If on premise and not scoped for on premise, skip check.
  if (!hosted && !onPremiseScopes.includes(body.type)) {
    return body;
  }

  // Enable turning off req
  if (process.env.SKIP_FORM_LICENSING && ['formRequest', 'submissionRequest'].includes(body.type)) {
    return body;
  }

  if (!hosted) {
    // Tell server to return a hash.
    qs.hash = 1;
    // Timestamp required for hash
    body.timestamp = Date.now() - 6000;
  }

  const response = await fetch(`${licenseServer}/utilization${action}`, {
    method: 'post',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(body),
    timeout: 30000,
    qs,
    rejectUnauthorized: false,
  });

  if (!response.ok) {
    throw {
      message: await response.text()
    };
  }

  const utilization = await response.json();

  if (!hosted && utilization.hash !== md5(base64(body))) {
    throw new Error('Invalid response');
  }

  lastUtilizationTime = Date.now();

  return utilization;
}

async function cachedUtilization(cacheKey, body, action, qs = {terms: 1}) {
  // If there is no cache, evaluate and set cache.
  if (!cache.get(cacheKey)) {
    await utilization(body, action, qs);
    cache.set(cacheKey, true, CACHE_TIME);
  }
  else {
    // A cached success exists so don't wait for a response. This will fire off another utilization request
    // and set the cache for the next request.
    utilization(body, action, qs)
      .then(() => {
        cache.set(cacheKey, true, CACHE_TIME);
      })
      .catch((err) => {
        cache.del(cacheKey);
      });
  }
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
  license.save();
  try {
    await clearLicenseCache(license._id);
  }
  catch (err) {
    // Ignore error. This is only trying to clear cache.
  }
}

async function clearLicenseCache(licenseId) {
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

module.exports = {
  utilization,
  cachedUtilization,
  createLicense,
  getProjectContext,
  getLicenseKey,
  getLicense,
  setLicensePlan,
  checkLastUtilizationTime
};
