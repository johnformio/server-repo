'use strict';

const config = require('../../config.js');
const {utilizationSync, getNumberOfExistingProjects, licenseConfig} = require('../util/utilization');
const crypto = require('crypto');
const {compactVerify} = require('jose');
const _ = require('lodash');

const terms = {};

module.exports = {
  validate: validateWithGracefulDegradation,
  getEnvironmentId: getEnvironmentId,
  generateMiddleware: app => (req, res, next) => {
    if (app.restrictMethods) {
      if (['PUT', 'PATCH', 'POST'].includes(req.method)) {
        if (
          req.path.match(/form/)  &&
          !req.path.match(/submission/)||
          req.path.match(/import/) ||
          req.path.match(/tag/) ||
          req.path.match(/deploy/) ||
          req.path.match(/project/) && req.method === 'POST'
          ) {
          return res.status(503 /* Service Unavailable */).send('Server is in restricted method mode');
        }
        return next();
    }
      return next();
  }
    return next();
  },
  terms
};

async function validateWithGracefulDegradation(app) {
  //
  // Kick off our validation process:
  //
  //  1. Attempt validation against the license server. If it
  //     fails to respond, try again every 5 seconds for up to
  //     100 tries.
  //
  //  2. If we couldn't communicate with the license server,
  //     print a warning message to the console and explain that
  //     we'll try again in 12 hours.
  //
  //  3. After 12 hours, repeat step 1. If we still can't confirm
  //     the license, tell the middleware (see above) to enter
  //     restricted method mode and respond to PUT, PATCH, and
  //     DELETE requests with a 503 Service Unavailable error.
  //     PUTs relating to form drafts are exempted.
  //
  //  4. If, at any point, we get an affirmative response from
  //     the licensing server that the license is known to be
  //     invalid, force the server to exit immediately.
  //
  app.license = await performValidationRound(app);

  if (!app.license) {
    // First warning
    // eslint-disable-next-line no-console
    console.log(`


      !!!!!!!!!!!!!
      !  WARNING  !
      !!!!!!!!!!!!!

      Communication with the licensing server has failed after repeated attempts.

      If https://license.form.io is accessible outside of this network, this may
      be due to a network configuration issue specific to this server deployment.

      Another round of validation attempts will begin in 12 hours. If validation
      still fails, the server will enter a restricted method mode that prevents
      PUT, PATCH, or DELETE requests.


    `.replace(/ {6}/g, ''));

    setTimeout(async () => {
      app.license = await performValidationRound(app);

      if (!app.license) {
        // Activate restricted method mode
        app.restrictMethods = true;

        // eslint-disable-next-line no-console
        console.log(`


          !!!!!!!!!!!!!!!
          !   WARNING   !
          !-------------!
          ! RESTRICTED  !
          ! MODE ACTIVE !
          !!!!!!!!!!!!!!!

          Communication with the licensing server has failed after repeated attempts.

          If https://license.form.io is accessible outside of this network, this may
          be due to a network configuration issue specific to this server deployment.

          The server has entered a restricted method mode that prevents PUT, PATCH,
          or DELETE requests.


        `.replace(/ {10}/g, ''));
      }
    }, 12 * 60 * 60 * 1000);
  }
}

async function performValidationRound(app) {
  app.environmentId = await getEnvironmentId(app);
  const hostname = require('os').hostname();

  // eslint-disable-next-line no-console
  console.log('\nValidating license key...');
  console.log(`Scope = API Server`);
  console.log(`Environment ID = ${app.environmentId}`);
  console.log(`Hostname = ${hostname}`);

  if (!config.licenseKey) {
    // eslint-disable-next-line no-console
    console.log('No license key detected. Please set in LICENSE_KEY environment variable.');
    process.exit();
  }

  if (config.licenseRemote) {
    licenseConfig.remote = true;
    try {
      const pubkey = crypto.createPublicKey(`-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAvfrMKWDgcffKI86ZPj8D
dnACabymCcjXLkX/nO9dVvlpVOnZFr7ibDiLd3Op1orUrRyPJ0R3bur4UZKXDlns
p1wUx5kgTa/q57LV6GRCJQIjLEu+1UZcBAC7so2zV1a9lWSnWBQJA/CsCeANtN9F
UGZYFOj9EprKLUShEno9+re2vDkjA2O2tavRjiftG+dG+LA6swPjo3L+ux2z4KPi
BJuplQVPoTukLbb4wGXoJnt7cIrmw3SjPC+0kqWBTY+pfuQFtIMPxbA/4nWuUQfC
eI4B/9wVSAWiSGmJL9CtnVJE/oFQVChDr2GYU0+5uKBV7w0ojaddQwuggmrKQU1W
JeMsyw8iDlHwbvH8nD5M2x6O7Pr8Ub7/L0xO0KSOuuz4OddmPcIO6RQWQ8syeUxh
NB7yryb/BEJH44n16GWd54dY3hpSeI2Vm/12qxt946ui081Ss13sjlyOt6kcXbGn
HNGm9NZJnkHVrLybZMZrXEpBfSLqHWcFCQSQzHBS3PifUCeOFjdLebOyGbFd0rdh
bJcTkVafzW5LxWsJX55zSUj8AvyKnQgbcr+kcLqBnZyvQ6m8NmZVroX1wZeQXTHu
6rOqGz9EgYOSwypDJRqBuefwlhhAs7r53qqfIFVDaRbzrZuUh3SlZF2ifkMDBoy+
KuKgTy9kdUG5qewqC7H6Jo8CAwEAAQ==
-----END PUBLIC KEY-----`);
      let {payload} = await compactVerify(config.licenseKey, pubkey);
      payload = JSON.parse(new TextDecoder().decode(payload));
      // eslint-disable-next-line no-console
      if (payload.exp < parseInt(Date.now() / 1000)) {
        console.log(`

        License is expired.

        !!!!!!!!!!!!!!!
        !   WARNING   !
        !-------------!
        ! RESTRICTED  !
        ! MODE ACTIVE !
        !!!!!!!!!!!!!!!

      `);
        app.restrictMethods = true;
      }
      const numberOfProjects = await getNumberOfExistingProjects(app.formio.formio);
      if (payload.terms.projectsNumberLimit && numberOfProjects > payload.terms.projectsNumberLimit) {
        console.log(`

        Exceeded the allowed number of projects. Max number of your projects is ${payload.terms.projectsNumberLimit}. You have ${numberOfProjects} projects.

        !!!!!!!!!!!!!!!
        !   WARNING   !
        !-------------!
        ! RESTRICTED  !
        ! MODE ACTIVE !
        !!!!!!!!!!!!!!!

        `);
        app.restrictMethods = true;
      }
      if (_.get(payload, 'terms.options.hosted', false)) {
        config.formio.hosted = true;
      }
      if (!app.restrictMethods) {
        console.log('License key validated remotely');
      }
      payload.remote = true;
      return payload;
    }
    catch (err) {
      console.log('Invalid license');
      process.exit(1);
    }
  }

  return await submitUtilizationRequest(app, {
    // Base validation fields
    type: 'apiServer',
    licenseKey: config.licenseKey,
    environmentId: app.environmentId,
    // Extra details for log
    mongoHash: md5(config.formio.mongo),
    hostname,
  });
}

/* eslint-disable no-console */
async function submitUtilizationRequest(
  app,
  payload,
  attempts = 0,
  MAX_ATTEMPTS = 100,
  INTERVAL = 5 * 1000
) {
  const result = await utilizationSync(app, payload.type, payload);
  if (result.error) {
    const err = result.error;

    // eslint-disable-next-line no-console
    console.log(`Error while validating license key: ${err.message}`);

    // If it's a server error, retry
    if (!err.statusCode || err.statusCode >= 500 || err.statusCode !== 403) {
      // (unless we've hit the max number of attempts)
      if (attempts >= MAX_ATTEMPTS) {
        // eslint-disable-next-line no-console
        console.log('Max attempts exceeded - unable to validate license key with license server');
        return false;
      }

      console.log(`Retrying in ${INTERVAL / 1000}s...`);

      return require('bluebird').delay(INTERVAL).then(
        () => submitUtilizationRequest(app, payload, attempts + 1, MAX_ATTEMPTS)
      );
    }
    // Otherwise, print an error and exit
    else {
      // eslint-disable-next-line no-console
      console.log(err.message || 'Invalid license key');
      process.exit();
    }
  }
  if (result && result.devLicense) {
    const regexUri = /^mongodb:\/\/((localhost)|(mongo)):\d+\/[a-z0-9_-]+/i;
    const regexReplica = /replicaSet/gi;
    const regexTslSsl = /((tls)|(ssl))=true/gi;

    if (!regexUri.test(config.formio.mongo)) {
      console.log('Invalid MongoDB URI. With Development License you can use only a local database.');
      process.exit();
    }

    if (regexReplica.test(config.formio.mongo)) {
      console.log('Invalid MongoDB URI. With Development License you can not use Replica Sets.');
      process.exit();
    }

    if (regexTslSsl.test(config.formio.mongo)) {
      console.log('Invalid MongoDB URI. With Development License you can not use SSL or TLS connection.');
      process.exit();
    }
  }

  // eslint-disable-next-line no-console
  console.log('License key validated');

  // Save the received license terms to the exported terms reference
  Object.assign(terms, result.terms);

  return result;
}

function md5(str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
}

async function getEnvironmentId(app) {
  const schema = app.formio.formio.mongoose.models.schema;
  let dbIdentifierRecord = await schema.findOne({key: 'dbIdentifier'});

  if (!dbIdentifierRecord) {
    dbIdentifierRecord = await schema.create({
      key: 'dbIdentifier',
      value: new app.formio.formio.mongoose.Types.ObjectId()
    });
  }

  return dbIdentifierRecord.value;
}
