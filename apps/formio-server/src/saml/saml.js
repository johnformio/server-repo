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
        if (!settings || !settings.sp || !settings.idp) {
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
          const validRoles = (roles && roles.length) ? roles.map((role) => role._id.toString()) : [];
          const roleMap = _.filter(settings.roles.map((role) => {
            if (validRoles.indexOf(role.id) !== -1) {
              return role;
            }
            return false;
          }));

          const reader = new MetadataReader(settings.idp);
          const config = toPassportConfig(reader);
          config.issuer = settings.issuer;
          config.callbackUrl = settings.callbackUrl;
          const saml = new SAML(config);
          return resolve({
            saml: saml,
            project: project,
            projectRoles: roles,
            roles: roleMap,
            settings: settings
          });
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
  const getToken = function(profile, settings, project, roleMap) {
    let userRoles = _.get(profile, (settings.rolesPath || 'roles'));
    if (typeof userRoles === 'string') {
      if (userRoles.indexOf(',') !== -1) {
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
    userRoles = userRoles.map(_.trim);

    // Add an "Everyone" role.
    userRoles.push('Everyone');

    const userId = _.get(profile, (settings.idPath || 'id'));
    const roles = [];
    roleMap.map(map => {
      if (!map.role || _.includes(userRoles, _.trim(map.role))
      ) {
        roles.push(map.id);
      }
    });

    // Make sure to throw an error if no user id was found within the saml profile.
    if (!userId) {
      return 'No User ID was found within your SAML profile.';
    }

    const user = {
      _id: toMongoId(userId),
      data: profile,
      roles
    };

    // If this is the primary project and they user using PORTAL_SSO, then we need to have a way to map the roles
    // within the saml profile to Teams within the Form.io system. To do this, we will assign a "teams" property on
    // the user object that will be read by the teams feature to determine which teams are allocated to this user.
    if (project.primary && config.portalSSO) {
      user.teams = userRoles;
    }

    const token = {
      external: true,
      user,
      project: {
        _id: project._id.toString()
      }
    };

    return {
      user: user,
      decoded: token,
      token: formio.auth.getToken(token)
    };
  };

  // Release the metadata publicly
  router.get('/metadata', (req, res) => {
    getSAMLProviders(req).then((providers) => {
      return res.header('Content-Type','text/xml').send(providers.saml.generateServiceProviderMetadata());
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
          res.status(400).send(err.message || err);
        }
        if (providers.settings.query) {
          redirect = `${redirect}&${providers.settings.query}`;
        }
        return res.redirect(redirect);
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  router.post('/acs', (req, res) => {
    // Get the relay.
    const relay = req.query.relay || req.body.RelayState;
    if (!relay) {
      return res.status(400).send('No relay provided.');
    }
    getSAMLProviders(req).then((providers) => {
      providers.saml.validatePostResponse(req.body, (err, profile) => {
        if (err) {
          return res.status(400).send(err.message || err);
        }

        const token = getToken(
          profile,
          providers.settings,
          providers.project,
          providers.roles
        );
        if (!token) {
          return res.status(401).send('Unauthorized');
        }
        if (typeof token === 'string') {
          return res.status(401).send(token);
        }

        return res.redirect(`${relay}?saml=${token.token}`);
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  return router;
};
