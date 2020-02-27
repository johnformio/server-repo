'use strict';
const request = require('request-promise-native');
const _ = require('lodash');
const {StatusCodeError} = require('request-promise-native/errors');
const licenseServer = process.env.LICENSE_SERVER || 'https://license.form.io';
const NodeCache = require('node-cache');

const cache = new NodeCache();

// Cache response for 3 hours.
const CACHE_TIME =  process.env.CACHE_TIME || 3 * 60 * 60 * 1000;

const getLicenseKey = (req) => {
  return _.get(req, 'primaryProject.settings.licenseKey', _.get(req, 'licenseKey', process.env.LICENSE_KEY));
};

function md5(str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
}

function base64(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

const getProjectContext = (req) => {
  switch (_.get(req, 'currentProject.type', req.body.type || 'project')) {
    case 'tenant':
      return {
        type: 'tenant',
        projectId: req.primaryProject._id,
        tenantId: req.currentProject ? req.currentProject._id : 'new',
        title: req.currentProject ? req.currentProject.title : req.body.title,
        name: req.currentProject ? req.currentProject.name : req.body.name,
        remote: req.currentProject ? !!req.currentProject.remote : false,
        projectType: req.currentProject ? req.currentProject.type : req.body.type,
      };
    case 'stage':
      return {
        type: 'stage',
        projectId: req.primaryProject._id,
        tenantId: req.parentProject._id.toString() !== req.primaryProject._id.toString() ? req.parentProject._id : 'none',
        stageId: req.currentProject ? req.currentProject._id : 'new',
        title: req.currentProject ? req.currentProject.title : req.body.title,
        name: req.currentProject ? req.currentProject.name : req.body.name,
        remote: req.currentProject ? !!req.currentProject.remote : false,
        projectType: req.currentProject ? req.currentProject.type : req.body.type,
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
  const onPremiseScopes = ['apiServer', 'pdfServer', 'project', 'tenant', 'stage', 'formManager'];

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

  const utilization = await request({
    url: `${licenseServer}/utilization${action}`,
    method: 'post',
    headers: {'content-type': 'application/json'},
    qs,
    body,
    json: true,
    timeout: 5000,
  });

  if (!hosted && utilization.hash !== md5(base64(body))) {
    throw new StatusCodeError(400, 'Invalid response');
  }

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

async function setLicensePlan(formio, licenseKey, plan, limits = {}, addScopes = [], removeScopes = []) {
  const license = await getLicense(formio, licenseKey);
  if (!license) {
    throw new Error('No license found');
  }
  let data = license.toObject().data;
  data.plan = plan;
  _.set(data, 'licenseKeys[0].scope', _.uniq([..._.get(data, 'licenseKeys[0].scope'), ...addScopes]));
  _.set(data, 'licenseKeys[0].scope', _.difference(_.get(data, 'licenseKeys[0].scope'), removeScopes));
  data = _.merge(data, limits);
  license.data = data;
  license.save();
}

module.exports = {
  utilization,
  cachedUtilization,
  createLicense,
  getProjectContext,
  getLicenseKey,
  getLicense,
  setLicensePlan,
};
