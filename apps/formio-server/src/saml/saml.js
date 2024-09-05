'use strict';
const debug = require('debug')('formio:saml');
const util = require('../util/util');
const router = require('express').Router();
const _ = require('lodash');
const {SAML} = require('@node-saml/node-saml');
const MetadataReader = require('./MetadataReader');
const toPassportConfig = require('./toPassportConfig');
const xss = require("xss");
const {getConfig} = require("../../config");
const fs = require("fs");
const path = require('path');
const {evaluate} = require('@formio/vm');

module.exports = (formio, config) => {
  const parseSAMLPassportSettings = (settings) => {
    const pathToDecryptionPrivateKey = getConfig("SAML_PASSPORT_DECRYPTION_PVK_PATH", null);
    const pathToPrivateKey = getConfig("SAML_PASSPORT_PRIVATE_KEY_PATH", null);
    const samlPassportConfig = (typeof settings.passport === 'string') ? JSON.parse(settings.passport) : settings.passport;
    if (!samlPassportConfig.callbackUrl && settings.callbackUrl) {
      samlPassportConfig.callbackUrl = settings.callbackUrl;
    }

    if (pathToDecryptionPrivateKey) {
      if (!path.isAbsolute(pathToDecryptionPrivateKey)) {
        debug('ERROR: SAML_PASSPORT_DECRYPTION_PVK_PATH does not support relative paths, falling back to SAML passport settings JSON...');
      }
      else {
        samlPassportConfig.decryptionPvk = fs.readFileSync(pathToDecryptionPrivateKey, 'utf-8');
      }
    }
    if (pathToPrivateKey) {
      if (!path.isAbsolute(pathToPrivateKey)) {
        debug('SAML_PASSPORT_PRIVATE_KEY_PATH does not support relative paths, falling back to SAML passport settings JSON...');
      }
      else {
        samlPassportConfig.privateKey = fs.readFileSync(pathToPrivateKey, 'utf-8');
      }
    }
    return samlPassportConfig;
  };

  const getUserSamlRoles = (userRoles, rolesDelimiter) => {
    if (typeof userRoles === 'string') {
      if (rolesDelimiter) {
        userRoles = userRoles.split(rolesDelimiter);
      }
      else if (userRoles.indexOf(',') !== -1) {
        userRoles = userRoles.split(',');
      }
      else if (userRoles.indexOf(';') !== -1) {
        userRoles = userRoles.split(';');
      }
      else {
        userRoles = userRoles.split(' ');
      }
    }

    // Trim all whitespace from the roles.
    userRoles = _.map(userRoles, _.trim);

    // Add an "Everyone" role.
    userRoles.push('Everyone');

    return userRoles;
  };

  // Get the SAML providers for this project.
  const getSAMLProviders = async function(req) {
        const project = await formio.cache.loadCurrentProject(req);
        if (!project) {
          debug('Unable to load project');
          throw new Error('Unable to load project');
        }
        const settings = _.get(project, 'settings.saml', null);
        if (
          !settings || (!settings.idp && !settings.passport)
        ) {
          debug('Project is not configured for SAML');
          throw new Error('Project is not configured for SAML');
        }

        // Load the valid roles for this project.
        try {
          const roles = await formio.resources.role.model.find({
            project: formio.util.idToBson(project._id),
            deleted: {$eq: null}
          }).exec();

          // Make sure to only allow valid role ids.
          const validRoles = (roles && roles.length) ? _.map(roles, (role) => role._id.toString()) : [];
          const roleMap = _.filter(_.map(settings.roles, (role) => {
            if (validRoles.indexOf(role.id) !== -1) {
              return role;
            }
            return false;
          }));

          let config = null;
          try {
            if (settings.passport) {
              config = parseSAMLPassportSettings(settings);
            }
            else if (settings.idp) {
              config = toPassportConfig(new MetadataReader(settings.idp));
              config.issuer = settings.issuer;
              config.callbackUrl = settings.callbackUrl;
            }
          }
          catch (err) {
            // We'll log that an error occurred but not the error object in case it has sensitive project settings (e.g. private keys)
            debug("Error while parsing SAML settings");
          }
          if (!config) {
            throw new Error('Invalid SAML Configuration');
          }
          try {
            // Fix "authnContext" configuration option which changed in recent versions from a string to an array.
            if (config.authnContext && !_.isArray(config.authnContext)) {
              config.authnContext = [config.authnContext];
            }
            const saml = new SAML(config);
            return {
              saml: saml,
              project: project,
              projectRoles: roles,
              roles: roleMap,
              settings: settings
            };
          }
          catch (err) {
            throw new Error(err.message || err);
          }
      }
      catch (err) {
        throw new Error('Unable to load project roles');
      }
  };

  /**
   * Get a JWT token in exchange for a SAML request.
   *
   * @param profile
   * @param project
   * @param roleMap
   * @return {*}
   */
  const getToken = async function(profile, settings, project, roleMap) {
    let user = {};
    let userRoles = [];
    if (settings.customParser) {
      try {
        const customParserData  = await evaluate({
          deps: ['lodash'],
          code: settings.customParser,
          data: {
            profile: (_.omitBy(profile, _.isFunction)),
            roles: project.roles
          }
        });
        if (typeof customParserData !== 'object') {
          throw new Error('User not an object.');
        }
        if (!customParserData.hasOwnProperty('_id')) {
          throw new Error('_id not defined on user.');
        }
        if (typeof customParserData._id !== 'string') {
          throw new Error('_id not a string.');
        }
        if (!customParserData.hasOwnProperty('roles')) {
          throw new Error('roles not defined on user.');
        }
        if (!Array.isArray(customParserData.roles)) {
          throw new Error('roles not an array.');
        }
        if (!customParserData.data.hasOwnProperty('roles')) {
          throw new Error('SAML roles not defined on user.data.');
        }

        // Make sure assigned role ids are actually in the project.
        const roleIds = _.map(project.roles, role => role._id.toString());
        customParserData.roles.forEach(roleId => {
          if (!roleIds.includes(roleId)) {
            throw new Error('Invalid role id. Not in the project.');
          }
        });

        user = {
          _id: util.toMongoId(customParserData._id),
          sso: true,
          project: project._id.toString(),
          data: customParserData.data,
          roles: customParserData.roles
        };

        userRoles = getUserSamlRoles(customParserData.data.roles);

        if (customParserData.access) {
          user.access = customParserData.access;
        }
      }
      catch (err) {
        throw new Error(`Error parsing JWT token: ${err.message}`);
      }
    }
    else {
      const rolesPath = settings.rolesPath || 'roles';
      const idPath = settings.idPath || 'id';
      const emailPath = settings.emailPath || 'email';
      const {rolesDelimiter} = settings;
      userRoles = getUserSamlRoles(_.get(profile, rolesPath, []), rolesDelimiter);

      const email = _.get(profile, emailPath)?.toLowerCase();
      const userId = _.get(profile, idPath, email);
      if (!userId) {
        throw new Error('No User ID or Email was found within your SAML profile.');
      }

      const roles = [];
      _.map(roleMap, map => {
        const roleName = _.trim(map.role);
        if (_.includes(userRoles, roleName)) {
          roles.push(map.id);
        }
      });

      const defaultFields = `objectidentifier,name,email,inresponseto,${rolesPath},${idPath},${emailPath}`;
      let profileFields = settings.hasOwnProperty('profileFields') ? (settings.profileFields || defaultFields) : false;
      profileFields = profileFields ? _.map(profileFields.split(','), _.trim).join('|').replace(/[^A-z0-9_|-]/g, '') : '';
      const fieldsRegex = new RegExp(profileFields || '', 'i');
      user = {
        _id: util.toMongoId(userId),
        sso: true,
        project: project._id.toString(),
        data: profileFields ? _.pickBy(profile, (prop, key) => key.match(fieldsRegex)) : profile,
        roles
      };

      // If an email is provided, then set it here.
      if (email) {
        user.data.email = email;
      }

      if (settings.tenantAccess) {
        _.forEach(userRoles, (role) => {
          const tenantAccess = _.find(settings.tenantAccess, {samlRole: role});
          if (tenantAccess) {
            _.set(user, `access.${tenantAccess.tenant}`, tenantAccess.role);
          }
        });
      }
    }

    debug(`Requested Roles: ${JSON.stringify(userRoles)}`);
    debug(`User: ${JSON.stringify(user)}`);
    debug(`Project: ${project._id.toString()}`);
    const token = {
      external: true,
      user,
      project: {
        _id: project._id.toString()
      }
    };

    // If this is the primary project and they user using PORTAL_SSO, then we need to have a way to map the roles
    // within the saml profile to Teams within the Form.io system. To do this, we will assign a "teams" property on
    // the user object that will be read by the teams feature to determine which teams are allocated to this user.
    if (project.primary && config.ssoTeams) {
      // Load the teams by name.
      return await formio.teams.getSSOTeams(user, userRoles).then((teams) => {
        teams = teams || [];
        user.teams = _.map(_.map(teams, '_id'), formio.util.idToString);
        debug(`Teams: ${JSON.stringify(user.teams)}`);
        return {
          user,
          decoded: token,
          token: formio.auth.getToken(token),
        };
      });
    }
    else {
      return {
        user,
        decoded: token,
        token: formio.auth.getToken(token),
      };
    }
  };

  // Release the metadata publicly
  router.get('/metadata', (req, res) => {
    getSAMLProviders(req).then((providers) => {
      return res.header('Content-Type','text/xml').send(providers.saml.generateServiceProviderMetadata(
        providers.saml.options.decryptionPvk,
        providers.saml.options.privateKey
      ));
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  // Access URL for implementing SP-init SSO
  router.get('/sso', (req, res) => {
    getSAMLProviders(req).then((providers) => {
      providers.saml.getAuthorizeUrlAsync(req.query.relay).then((redirect) => {
        if (providers.settings.query) {
          redirect = `${redirect}&${providers.settings.query}`;
        }
        debug(`Redirect: ${redirect}`);
        return res.redirect(redirect);
      }).catch((err) => {
        return res.status(400).send(err.message || err);
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  router.post('/passport', (req, res) => {
    const settings = req.body;
    const config = toPassportConfig(new MetadataReader(settings.idp));
    if (settings.issuer) {
      config.issuer = settings.issuer;
    }
    if (settings.callbackUrl) {
      config.callbackUrl = settings.callbackUrl;
    }
    const sanitizeConfig = xss(JSON.stringify(config));
    res.status(200).send(sanitizeConfig);
  });

  router.post('/acs',
    (req, res) => {
    let fromSettings = false;
    if (_.endsWith(req.body.RelayState, 'samlconfig')) {
      fromSettings = true;
    }
    const sanitizeRelay =  xss(req.query.relay);
    const sanitizeRelayState =  xss(req.body.RelayState);
    if ((req.query.relay!==undefined && sanitizeRelay !== req.query.relay) || sanitizeRelayState !== req.body.RelayState) {
      return res.status(400).send('SAML Validation failed!');
    }
    // Get the relay.
    let relay = sanitizeRelay || sanitizeRelayState;
    if (!relay) {
      return res.status(400).send('No relay provided.');
    }
    getSAMLProviders(req).then((providers) => {
      providers.saml.validatePostResponseAsync(req.body).then(async ({profile}) => {
        if (fromSettings) {
          const sanitizeProfile = xss(JSON.stringify(profile, null, "\t"));
          res.end(sanitizeProfile);
        }
        else {
          // Get the saml token.
          const token = await getToken(profile, providers.settings, providers.project, providers.roles);
          if (!token) {
            return res.status(401).send('Unauthorized');
          }
          if (typeof token === 'string') {
            return res.status(401).send(token);
          }

          relay += (relay.indexOf('?') === -1) ? '?' : '&';
          relay += `saml=${token.token}`;
          return res.redirect(relay);
        }
      }).catch((err) => {
        return res.status(400).send(xss(err.message || err));
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  return router;
};
