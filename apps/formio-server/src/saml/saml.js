'use strict';
const debug = require('debug')('formio:saml');
const router = require('express').Router();
const _ = require('lodash');
const SAML = require('passport-saml/lib/passport-saml/saml').SAML;
const {MetadataReader, toPassportConfig} = require('passport-saml-metadata');
module.exports = (formioServer) => {
  const formio = formioServer.formio;
  const config = formioServer.config;

  // Get the SAML providers for this project.
  const getSAMLProviders = function(req) {
    return new Promise((resolve, reject) => {
      formio.cache.loadCurrentProject(req, function(err, project) {
        if (err) {
          debug('Unable to load project');
          return reject('Unable to load project');
        }

        const settings = _.get(project, 'settings.saml', null);
        if (
          !settings || (!settings.idp && !settings.passport)
        ) {
          debug('Project is not configured for SAML');
          return reject('Project is not configured for SAML');
        }

        // Load the valid roles for this project.
        formio.resources.role.model.find({
          project: project._id,
          deleted: {$eq: null}
        }).exec((err, roles) => {
          if (err) {
            return reject('Unable to load project roles');
          }

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
              config = (typeof settings.passport === 'string') ? JSON.parse(settings.passport) : settings.passport;
              if (!config.callbackUrl && settings.callbackUrl) {
                config.callbackUrl = settings.callbackUrl;
              }
            }
            else if (settings.idp) {
              config = toPassportConfig(new MetadataReader(settings.idp));
              config.issuer = settings.issuer;
              config.callbackUrl = settings.callbackUrl;
            }
          }
          catch (err) {
            // Do nothing.
          }
          if (!config) {
            return reject('Invalid SAML Configuration');
          }
          try {
            const saml = new SAML(config);
            return resolve({
              saml: saml,
              project: project,
              projectRoles: roles,
              roles: roleMap,
              settings: settings
            });
          }
          catch (err) {
            return reject(err.message || err);
          }
        });
      });
    });
  };

  const toMongoId = function(id) {
    id = id || '';
    let str = '';
    for (let i = 0; i < id.length; i++) {
      str += id[i].charCodeAt(0).toString(16);
    }
    return _.padEnd(str.substr(0, 24), 24, '0');
  };

  /**
   * Get a JWT token in exchange for a SAML request.
   *
   * @param profile
   * @param project
   * @param roleMap
   * @return {*}
   */
  const getToken = function(profile, settings, project, roleMap, next) {
    const rolesPath = settings.rolesPath || 'roles';
    const idPath = settings.idPath || 'id';
    const emailPath = settings.emailPath || 'email';
    let userRoles = _.get(profile, rolesPath, []);
    const roleTeams = _.cloneDeep(userRoles);
    const {rolesDelimiter} = settings;
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

    const email = _.get(profile, emailPath);
    const userId = _.get(profile, idPath, email);
    if (!userId) {
      return next('No User ID or Email was found within your SAML profile.');
    }

    const roles = [];
    const roleNames = [];
    _.map(roleMap, map => {
      const roleName = _.trim(map.role);
      if (_.includes(userRoles, roleName)) {
        roles.push(map.id);
        roleNames.push(roleName);
      }
    });

    const defaultFields = `objectidentifier,name,email,inresponseto,${rolesPath},${idPath},${emailPath}`;
    let profileFields = settings.hasOwnProperty('profileFields') ? (settings.profileFields || defaultFields) : false;
    profileFields = profileFields ? _.map(profileFields.split(','), _.trim).join('|').replace(/[^A-z0-9_|-]/g, '') : '';
    const fieldsRegex = new RegExp(profileFields || '', 'i');
    const user = {
      _id: toMongoId(userId),
      sso: true,
      project: project._id.toString(),
      data: profileFields ? _.pickBy(profile, (prop, key) => key.match(fieldsRegex)) : profile,
      roles
    };

    // If an email is provided, then set it here.
    if (email) {
      user.data.email = email;
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
      formio.teams.getSSOTeams(user, roleTeams).then((teams) => {
        teams = teams || [];
        user.teams = _.map(_.map(teams, '_id'), formio.util.idToString);
        debug(`Teams: ${JSON.stringify(user.teams)}`);
        return next(null, {
          user,
          decoded: token,
          token: formio.auth.getToken(token),
        });
      });
    }
    else {
      return next(null, {
        user,
        decoded: token,
        token: formio.auth.getToken(token),
      });
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
      providers.saml.getAuthorizeUrl(req, {additionalParams: {
        RelayState: req.query.relay
      }}, (err, redirect) => {
        if (err) {
          return res.status(400).send(err.message || err);
        }
        if (providers.settings.query) {
          redirect = `${redirect}&${providers.settings.query}`;
        }
        debug(`Redirect: ${redirect}`);
        return res.redirect(redirect);
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  router.post('/acs', (req, res) => {
    // Get the relay.
    let relay = req.query.relay || req.body.RelayState;
    if (!relay) {
      return res.status(400).send('No relay provided.');
    }
    getSAMLProviders(req).then((providers) => {
      providers.saml.validatePostResponse(req.body, (err, profile) => {
        if (err) {
          return res.status(400).send(err.message || err);
        }

        // Get the saml token.
        getToken(
          profile,
          providers.settings,
          providers.project,
          providers.roles,
          (err, token) => {
            if (err) {
              return res.status(400).send(err);
            }
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
        );
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  return router;
};
