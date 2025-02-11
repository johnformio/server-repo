'use strict';

const express = require('express');
const router = express.Router();
const fetch = require('@formio/node-fetch-http-proxy');
const querystring = require('querystring');
const _ = require('lodash');

module.exports = function(formio) {
  router.get('/', async function(req, res) {
    try {
      const settings = await formio.hook.settings(req);
      const captchaType = req.query.captchaType;
      if (!_.get(settings, `${captchaType}.secretKey`, null)) {
        return res.status(400).send(`${captchaType} settings not set.`);
      }

      if (!req.query.captchaToken) {
        return res.status(400).send(`${captchaType} token is not specified`);
      }

      let url, options;
      let body = {
        secret: _.get(settings, `${captchaType}.secretKey`),
        response: req.query.captchaToken,
      };
      switch (captchaType) {
        case 'captcha':
          url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
          options = {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
              'content-type': 'application/json',
              'accept': 'application/json',
            }
          };
          break;
        case 'recaptcha':
        default:
          url = `https://www.google.com/recaptcha/api/siteverify?${querystring.stringify(body)}`;
          options = {method: 'POST'};
      }
      try {
        const response = await fetch(url, options);
        body = response.ok ? await response.json() : null;

        if (!body) {
          throw new Error(`No response from ${captchaType} provider`);
        }

        if (!body.success) {
          return res.send({success: false, message: `Unsuccessful response from ${captchaType} provider`});
        }

        const expirationTime = 600000; // 10 minutes

        // Create temp token with captcha response token as value
        // to verify it on validation step
        await formio.mongoose.models.token.create({
          value: req.query.captchaToken,
          expireAt: Date.now() + expirationTime,
        });
        res.send(body);
      }
      catch (err) {
        return res.status(400).send(err.message);
      }
    }
    catch (err) {
      return res.status(400).send(err.message);
    }
  });
  return router;
};
