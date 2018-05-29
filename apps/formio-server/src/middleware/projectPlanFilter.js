'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:middleware:projectPlanFilter');

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
      'office365', 'databases', 'google', 'kickbox', 'hubspot', 'sqlconnector', 'atlassian'
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

  return function(req, res, next) {
    const isPost = req.method === 'POST';
    const isPut = req.method === 'PUT';
    if (!isPost && !isPut) {
      return next();
    }

    formio.plans.getPlan(req, function(err, plan) {
      if (err || !plan) {
        debug(err || 'Project plan not found.');
        return next(err || 'Project plan not found.');
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
          if (process.env.DISABLE_RESTRICTIONS) {
            return next();
          }
          filterStorageSettings(req);
          return next();
        case 'basic':
        default:
          filterNameChanges(req);
          filterCorsChanges(req);
          if (process.env.DISABLE_RESTRICTIONS) {
            return next();
          }
          filterOAuthSettings(req);
          filterEmailSettings(req);
          filterStorageSettings(req);
          filterDataConnectionSettings(req);
          return next();
      }
    });
  };
};
