'use strict';

const router = require('express').Router();
const debug = require('debug')('formio:saml');
const _ = require('lodash');
const saml = require('samlify');
const ServiceProvider = saml.ServiceProvider;
const IdentityProvider = saml.IdentityProvider;
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

        /* eslint-disable new-cap */
        const sp = ServiceProvider({
          metadata: settings.sp
        });
        /* eslint-enable new-cap */

        if (req.query.relay) {
          // Set the relay state.
          sp.entitySetting.relayState = req.query.relay;
        }

        /* eslint-disable new-cap */
        return resolve({
          project: project,
          roles: settings.roles,
          settings: settings,
          sp: sp,
          idp: IdentityProvider({
            metadata: settings.idp
          })
        });
        /* eslint-enable new-cap */
      });
    });
  };

  /**
   * Get a JWT token in exchange for a SAML request.
   *
   * @param response
   * @param project
   * @param roleMap
   * @return {*}
   */
  const getToken = function(response, settings, project, roleMap) {
    if (response.statusCode !== 'urn:oasis:names:tc:SAML:2.0:status:Success') {
      return null;
    }

    const userData = _.get(response, (settings.dataPath || 'attributes'), {});
    let userRoles = _.get(response, (settings.rolesPath || 'attributes.roles'), '');
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
    const userId = _.get(response, (settings.idPath || 'response.id'));
    const roles = [];
    roleMap.map(map => {
      if (!map.role || _.includes(userRoles, map.role)
      ) {
        roles.push(map.id);
      }
    });

    const user = {
      _id: userId,
      userData,
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
      return res.header('Content-Type','text/xml').send(providers.sp.getMetadata());
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  // Access URL for implementing SP-init SSO
  router.get('/sso', (req, res) => {
    getSAMLProviders(req).then((providers) => {
      const {context} = providers.sp.createLoginRequest(providers.idp, 'redirect');
      return res.redirect(context);
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  router.post('/acs', (req, res) => {
    if (!req.body.RelayState) {
      return res.status(400).send('No relay provided.');
    }
    getSAMLProviders(req).then((providers) => {
      providers.sp.parseLoginResponse(providers.idp, 'post', req)
        .then(result => {
          const token = getToken(
            result.extract,
            providers.settings,
            providers.project,
            providers.roles
          );
          if (!token) {
            return res.status(401).send('Unauthorized');
          }

          return res.redirect(`${req.body.RelayState}?saml=${token.token}`);
        })
        .catch((err) => {
          return res.status(400).send(err.message || err);
        });
    }).catch((err) => {
      return res.status(400).send(err.message || err);
    });
  });

  return router;
};
