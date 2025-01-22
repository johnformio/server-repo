'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:2fa');

const LOG_EVENT = '2FA Recovery Login Action';

module.exports = router => {
  const formio = router.formio;
  const {
    Action,
    hook,
    twoFa
  } = router.formio;

  const ecode = router.formio.util.errorCodes;
  const logOutput = router.formio.log || debug;
  const log = (...args) => logOutput(LOG_EVENT, ...args);

  /**
   * TwoFaRecoveryLoginAction class.
   *   This class is used to create the 2FA Recovery Login action.
   */
  class TwoFaRecoveryLoginAction extends Action {
    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'twofarecoverylogin',
        title: '2FA Recovery Login',
        description: 'Provides 2FA Recovery Login.',
        priority: 2,
        defaults: {
          handler: ['before'],
          method: ['create']
        },
        access: {
          handler: false,
          method: false,
        },
      }));
    }

    /**
     * Settings form for auth action.
     *
     * @param req
     * @param res
     * @param next
     */
     static settingsForm(req, res, next) {
      const basePath = hook.alter('path', '/form', req);
      const dataSrc = `${basePath}/${req.params.formId}/components`;

      next(null, [
        {
          type: 'select',
          input: true,
          label: 'Recovery Code Field',
          key: 'token',
          placeholder: 'Select the Token field',
          template: '<span>{{ item.label || item.key }}</span>',
          dataSrc: 'url',
          data: {url: dataSrc},
          valueProperty: 'key',
          multiple: false,
          validate: {
            required: false,
          },
        },
      ]);
    }

    /**
     * Login 2FA with recovery code
     *
     * Note: Requires req.body to contain an 2FA authorization code.
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
      debug('Starting 2FA Recovery login');
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      if (!req.token || !req.user) {
        return res.status(400).send('2FA Recovery login Action is missing User.');
      }

      const is2FAEnabled = _.get(req.user, 'data.twoFactorAuthenticationEnabled', false);

      if (!is2FAEnabled) {
        return  res.status(400).send({
          message: '2FA Recovery login is not enabled for current account.',
          twoFaEnabled: false
        });
      }

      if (!this.settings) {
        debug('Missed settings');
        return res.status(400).send('Misconfigured 2FA Recovery login Action.');
      }

      if (!this.settings.token) {
        debug('Token field setting missing');
        return res.status(400).send('2FA Recovery login Action is missing Token Field setting.');
      }

      twoFa.loginWithRecoveryCode(
          req,
          res,
          _.get(req.submission.data, this.settings.token),
          (err) => {
        if (err) {
          log(req, ecode.auth.EAUTH, err);
          return res.status(400).send(err);
        }

        formio.auth.currentUser(req, res, (err) => {
          if (err) {
            log(req, ecode.auth.EAUTH, err);
            debug('2FA Recovery login Action Current User Failed');
            return res.status(401).send(err.message);
          }

          next();
        });
      });
    }
  }

  // Return the TwoFaRecoveryLoginAction.
  // Disable editing handler and method settings
  TwoFaRecoveryLoginAction.access = {
    handler: false,
    method: false
  };

  return TwoFaRecoveryLoginAction;
};
