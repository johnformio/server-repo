'use strict';
const debug = require('debug')('formio:saml');
const router = require('express').Router();
const _ = require('lodash');
const SAML = require('passport-saml/lib/passport-saml/saml').SAML;
const {MetadataReader, toPassportConfig} = require('passport-saml-metadata');
module.exports = (formio) => {
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

        const reader = new MetadataReader(settings.idp);
        const saml = new SAML(toPassportConfig(reader));
        return resolve({
          saml: saml,
          project: project,
          roles: settings.roles,
          settings: settings
        });
      });
    });
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
    let userRoles = profile.roles;
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
    const userId = _.get(profile, (settings.idPath || 'id'));
    const roles = [];
    roleMap.map(map => {
      if (!map.role || _.includes(userRoles, map.role)
      ) {
        roles.push(map.id);
      }
    });

    const user = {
      _id: userId,
      data: profile,
      roles
    };

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
        return res.redirect(redirect);
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  router.post('/acs', (req, res) => {
    if (!req.body.RelayState) {
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

        return res.redirect(`${req.body.RelayState}?saml=${token.token}`);
      });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  return router;
};
