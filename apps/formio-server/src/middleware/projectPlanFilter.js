'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectPlanFilter');
const config = require('../../config');

module.exports = function(formio) {
  const domain = function() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let rand = '';
    for (let i = 0; i < 15; i++) {
      const randNum = Math.floor(Math.random() * chars.length);
      rand += chars[randNum];
    }

    return rand;
  };

  /**
   * Helper function to filter name changes and force name assignment on creation.
   *
   * Note: For basic plans.
   *
   * @param req
   */
  const filterNameChanges = function(req) {
    req.body = _.omit(req.body, 'name');

    const isPost = req.method === 'POST';
    if (isPost) {
      req.body.name = domain();
    }
  };

  /**
   * Helper function to filter cors changes and force cors settings on creation.
   *
   * Note: For basic plans.
   *
   * @param req
   */
  const filterCorsChanges = function(req) {
    req.body.settings = req.body.settings || {};
    req.body.settings.cors = '*';
  };

  /**
   * Helper function to filter oauth changes for projects on the basic plan.
   *
   * @param req
   */
  const filterOAuthSettings = function(req) {
    req.body.settings = req.body.settings || {};
    req.body.settings = _.omit(req.body.settings, 'oauth');
  };

  /**
   * Helper function to filter premium email providers from projects on the basic plan.
   *
   * @param req
   */
  const filterEmailSettings = function(req) {
    req.body.settings = req.body.settings || {};
    if (_.has(req.body, 'settings.email')) {
      req.body.settings.email = _.pick(req.body.settings.email, ['smtp']);
    }
  };

  /**
   * Helper function to filter file storage providers from projects on the basic/independent plan.
   *
   * @param req
   */
  const filterStorageSettings = function(req) {
    req.body.settings = req.body.settings || {};
    if (_.has(req.body, 'settings.storage')) {
      req.body.settings = _.omit(req.body.settings, 'storage');
    }
  };

  const filterDataConnectionSettings = function(req) {
    req.body.settings = req.body.settings || {};
    req.body.settings = _.omit(req.body.settings, [
      'databases', 'google', 'kickbox', 'sqlconnector'
    ]);
  };

  /**
   * Ensure a name gets set if not sent.
   *
   * @param req
   */
  const generateNameIfMissing = function(req) {
    if (!req.body.hasOwnProperty('name')) {
      req.body.name = domain();
    }
  };

  return async function(req, res, next) {
    const isPost = req.method === 'POST';
    const isPut = req.method === 'PUT';
    if (!config.formio.hosted || (!isPost && !isPut)) {
      generateNameIfMissing(req);
      return next();
    }

    try {
      const plan = await formio.plans.getPlan(req);
      if (!plan) {
        debug('Project plan not found.');
        return next('Project plan not found.');
      }

      if (config.formio.hosted && req.body.plan !== plan) {
        req.body.plan = plan;
      }

      switch (plan.toString()) {
        case 'commercial':
        case 'team':
          generateNameIfMissing(req);
          return next();
        case 'trial':
          generateNameIfMissing(req);
          filterNameChanges(req);
          return next();
        case 'independent':
          generateNameIfMissing(req);
          filterCorsChanges(req);
          filterStorageSettings(req);
          return next();
        case 'basic':
        default:
          filterNameChanges(req);
          filterCorsChanges(req);
          filterOAuthSettings(req);
          filterEmailSettings(req);
          filterStorageSettings(req);
          filterDataConnectionSettings(req);
          return next();
      }
    }
 catch (err) {
      debug(err);
      return next(err);
    }
  };
};
