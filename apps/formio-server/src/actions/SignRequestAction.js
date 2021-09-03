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
          method: ['create', 'update', 'delete']
        }
      }));
    }

    static settingsForm(req, res, next) {
      SignRequestAction.checkApiSettings(req).then(() => {
        next(null, [
          {
            type: 'email',
            key: 'fromEmail',
            label: 'From Email',
            tooltip: 'The signrequest emails will be sent from this address.',
            input: true,
            validate: {
              required: true
            }
          },
          {
            type: 'checkbox',
            defaultValue: false,
            key: 'noOwnerSignature',
            label: 'My Signature Not Needed',
            tooltip: 'The document won\'t be sent to you to sign.',
            input: true,
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
      const {from, signers, noOwnerSignature} = submission;

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

      const signersArr = noOwnerSignature
        ? signers
        : [{
            order: 0,
            email: from.email,
            'first_name': from.name,
            'embed_url_user_id': uuidv4()
          }, ...signers];
      const whoSigns = noOwnerSignature && signersArr.length > 1
          ? 'o'
          : !noOwnerSignature && signersArr.length > 1
          ? 'mo'
          : 'm';

      const signrequestCreateBody = JSON.stringify({
        'from_email': from.email,
        'from_email_name': from.name,
        signers: signersArr,
        document: docUpload.url,
        who: whoSigns,
        'redirect_url': `${hostedUrl}/signrequest/confirmation.html`
      });

      const signrequestCreateRes = await fetch(`${signrequestConfig.apiUrl}/api/v1/signrequests/`, {
        method: 'POST',
        headers,
        body: signrequestCreateBody
      });
      const signrequestCreate = await signrequestCreateRes.json();

      let embedUrl = null;

      if (!noOwnerSignature && signrequestCreate.signers && signrequestCreate.signers.length) {
        embedUrl = signrequestCreate.signers[0]['embed_url'];
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
      const {settings, generateTempToken, uploadAndCreateSignrequest} = this;
      const hostedUrl = baseUrl(router.formio, req);

      const extractSignrequestData = (settings, form, submission) => {
        const {fromEmail, fromName, noOwnerSignature} = settings;
        const signatureComps = form.components.filter(comp => comp.type === 'signrequestsignature');

        if (!fromEmail || !signatureComps.length) {
          return;
        }

        const signers = signatureComps.map(comp => submission[comp.key]);

        return {
          from: {
            email: fromEmail,
            name: fromName
          },
          signers,
          noOwnerSignature
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
