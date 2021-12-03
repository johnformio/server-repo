'use strict';
const fetch = require('formio/src/util/fetch');
const {baseUrl} = require('../util/util');
const {v4: uuidv4} = require('uuid');

module.exports = (router) => {
  const Action = router.formio.Action;
  const hook = router.formio.hook;

  class SignRequestAction extends Action {
    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'signrequest',
        title: 'SignRequest',
        description: 'Allows you to use SignRequest components.',
        priority: 6,
        defaults: {
          handler: ['after'],
          method: ['create', 'update']
        }
      }));
    }

    static settingsForm(req, res, next) {
      SignRequestAction.checkApiSettings(req).then(() => {
        next(null, [
          {
            type: 'textfield',
            key: 'fromEmail',
            label: 'From Email',
            description: 'The SignRequest emails will be sent from this address. You can use interpolation with <b>data.myfield</b> or <b>submission.myfield</b> variables.',
            input: true,
            validate: {
              required: true,
              custom: 'valid = /\\{\\{([\\s\\S]+?)\\}\\}/g.test(input) ? true : /^(([^<>()[\\]\\\\.,;:\\s@"]+(\\.[^<>()[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$/.test(input)',
              customMessage: 'Must be a valid email'
            }
          }
        ]);
      });
    }

    static checkApiSettings(req) {
      return new Promise((resolve, reject) => {
        router.formio.hook.settings(req, (err, settings) => {
          if (err) {
            return reject(err.message || err);
          }

          if (!settings.signrequest) {
            return reject('The SignRequest must be configured in Project settings to use the SignRequest Action.');
          }

          if (!settings.signrequest.email) {
            return reject('The SignRequest user email must be configured to use the SignRequest Action.');
          }

          if (!settings.signrequest.apiUrl) {
            return reject('The SignRequest API URL must be configured to use the SignRequest Action.');
          }

          if (!settings.signrequest.apiKey) {
            return reject('The SignRequest API key must be configured to use the SignRequest Action.');
          }

          resolve();
        });
      });
    }

    async uploadAndCreateSignrequest(submission, fileUrl, eventsCallbackUrl, hostedUrl, signrequestConfig) {
      const {from, signers, who} = submission;

      const headers = {
        'content-type': 'application/json',
        'authorization': `Token ${signrequestConfig.apiKey}`
      };
      const docUploadBody = JSON.stringify({
        user: {
          email: signrequestConfig.email
        },
        name: `${uuidv4()}.pdf`,
        'file_from_url': fileUrl,
        'events_callback_url': eventsCallbackUrl
      });

      const docUploadRes = await fetch(`${signrequestConfig.apiUrl}/api/v1/documents/`, {
        method: 'POST',
        headers,
        body: docUploadBody
      });
      const docUpload = await docUploadRes.json();

      const signrequestCreateBody = JSON.stringify({
        'from_email': from.email,
        signers,
        document: docUpload.url,
        who,
        'redirect_url': `${hostedUrl}/signrequest/confirmation.html`
      });

      const signrequestCreateRes = await fetch(`${signrequestConfig.apiUrl}/api/v1/signrequests/`, {
        method: 'POST',
        headers,
        body: signrequestCreateBody
      });
      const signrequestCreate = await signrequestCreateRes.json();
      let embedUrl = null;

      if (signrequestCreate.signers && signrequestCreate.signers.length) {
        signrequestCreate.signers.some(signer => {
          if (signer.hasOwnProperty('embed_url')) {
            embedUrl = signer['embed_url'];
            return true;
          }
          return false;
        });
      }

      return embedUrl;
    }

    async generateTempToken(req, res, allowUrl, method, expires) {
      return new Promise((resolve, reject) => {
        const cb = (err, token) => {
          if (err) {
            reject(err);
          }
          resolve(token);
        };
        router.formio.auth.getTempToken(req, res, `${method.toUpperCase()}:${allowUrl}`, expires, false, cb);
      });
    }

    /**
     * Trigger the webhooks.
     *
     * @param handler
     * @param method
     * @param req
     *   The Express request object.
     * @param res
     *   The Express response object.
     * @param next
     *   The callback function to execute upon completion.
     */
    resolve(handler, method, req, res, next) {
      if (method === 'delete') {
        return next();
      }

      const {settings, generateTempToken, uploadAndCreateSignrequest} = this;
      const hostedUrl = baseUrl(router.formio, req);
      const {interpolate} =  router.formio.util.FormioUtils;

      const extractSignrequestData = (settings, form, submission) => {
        const {fromEmail} = settings;
        const signatureComps = form.components.filter(comp => comp.type === 'signrequestsignature');

        if (!fromEmail || !signatureComps.length) {
          return;
        }

        const email = interpolate(fromEmail, {data: submission});
        const signers = signatureComps.map(comp => submission[comp.key]);
        let isOwnerSigning = false;
        signers.forEach(signer => Object.keys(signer).forEach(key => {
          const value = interpolate(signer[key], {data: submission});
          signer[key] = key === 'order' ? Number(value) : value;
          if (signer.order === 0) {
            isOwnerSigning = true;
            signer.email = email;
            signer['embed_url_user_id'] = uuidv4();
          }
        }));

        const who = !isOwnerSigning ? 'o' : signers.length > 1 ? 'mo' : 'm';

        return {
          from: {email},
          signers,
          who
        };
      };

      router.formio.cache.loadProject(req, req.projectId, async function(err, project) {
        if (err) {
          return res.status(400).send('Project not found.');
        }

        const {signrequest: signrequestConfig} = project.settings;

        if (!signrequestConfig ||
            !signrequestConfig.email ||
            !signrequestConfig.apiUrl ||
            !signrequestConfig.apiKey
        ) {
          return res.status(400).send('SignRequest settings not set.');
        }

        const submissionId = res.resource && res.resource.item && res.resource.item._id.toString();
        const signrequestData = extractSignrequestData(settings, req.currentForm, req.submission.data);

        if (!submissionId || !signrequestData) {
          return res.status(400).send('SignRequest bad submission.');
        }

        const allowUrl = `${req.baseUrl}${req.url}/${submissionId}`;
        req.token.longExpire = true;

        const fileToken = await generateTempToken(req, res, `${allowUrl}/download`, 'get');
        const fileUrl = `${hostedUrl}${allowUrl}/download?token=${fileToken.key}`;

        const eventsCallbackUrl = `${hostedUrl}${allowUrl}/signrequest`;

        const embedUrl = await uploadAndCreateSignrequest(signrequestData, fileUrl, eventsCallbackUrl, hostedUrl, signrequestConfig);

        if (embedUrl) {
          res.submission.data.signrequest = {embedUrl};
        }

        return next();
      });
    }
  }

  return SignRequestAction;
};
