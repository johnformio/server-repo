'use strict';

const config = require('../../config.js');
const {utilizationSync, getNumberOfExistingProjects, licenseConfig} = require('../util/utilization');
const crypto = require('crypto');
const {compactVerify} = require('jose');

const terms = {};

module.exports = {
  validate: validateWithGracefulDegradation,
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
  if (process.env.FORMIO_HOSTED) {
    // eslint-disable-next-line no-console
    console.log('\nLicense check skipped');
    return true;
  }

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
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAyESFs0sS16TAOSiLE/XQ
tieqYESD265xHfLGoffQBhyoEJ+Bfma9NvSu6WYU5T8Y6mMz3bXtNGy32AMVvRNa
bNGi/BZxu0ZmR7GOTh8y58GQEW/hQ4qXfgW7UxBCDoCmZhnU3gtO2yW8GlWZl4WN
x/fp8oYivvXR30rboWCwEU9hadkJMKOeB/2dJRQJ3nQcPqX9VC4q0mXtcpbrn0qq
VxtHRJCQJbOuO5YhnVTe0FY+OHZp67sbOEXC5mesIZAz2xNqUlWIHFsFqrirQvoX
nzK0oaY8swXVIJO3slVgHY0fx7/FNdo29OioQDuPHWlXMlRM5F3Ro/Bc3t4cNNZC
GYmvNLI2bp2tFOHIdczYdh+vygklOqmO/7FpW2E2AS+vbmLuEaViyAYecdgC7aF5
ZsLwumQpO80kzPLc/t9pGkFATqKKYRHvSDvLqNG69ZzHWM0FLRbh6w4CKZ7MhkFv
EF01aANqOqx3p3bghu0xKBlvGHdR69BUs/ry5guDM2XKi7TiXZPTm4KdOOjlOltk
uppscNxvgK8Ljy/DJqBiX42idTmybr5GYAU5hcw+JcdPlLikn6whNM7kUCcl1aNu
IzaxfXn16qCWfwKGE+VXkSM7OAS5iunoyHr5QYL9bUh2+vKshM/pnhvoMfDXnIZR
3RR5A++atmNeqWrkKVPOpPMCAwEAAQ==
-----END PUBLIC KEY-----`);
      let {payload} = await compactVerify(config.licenseKey, pubkey);
      payload = JSON.parse(payload.toString());
      // eslint-disable-next-line no-console
      if (payload.exp < Date.now()) {
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
      if (!app.restrictMethods) {
        console.log('License key validated remotely');
      }
      payload.remote = true;
      return payload;
    }
    catch (err) {
      console.log('Invalid license');
      process.exit();
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
      value: app.formio.formio.mongoose.Types.ObjectId()
    });
  }

  return dbIdentifierRecord.value;
}
