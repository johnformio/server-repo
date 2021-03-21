'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:ldap');

const LOG_EVENT = '2FA Reset Action';

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
   * TwoFaResetAction class.
   *   This class is used to create the 2FA Reset action.
   */
  class TwoFaResetAction extends Action {
    static info(req, res, next) {
      next(null, hook.alter('actionInfo', {
        name: 'twofareset',
        title: '2FA Reset',
        description: 'Provides 2FA Reset.',
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
     * Reset 2FA with recovery code
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
      debug('Starting 2FA Reset');
      if (!hook.alter('resolve', true, this, handler, method, req, res)) {
        return next();
      }

      if (!req.token || !req.user) {
        return res.status(400).send('2FA Reset Action is missing User.');
      }

      const is2FAEnabled = _.get(req.user, 'data.twoFactorAuthenticationEnabled', false);

      if (!is2FAEnabled) {
        return  res.status(400).send({
          message: '2FA Reset is not enabled for current account.',
          twoFaEnabled: false
        });
      }

      if (!this.settings) {
        debug('Missed settings');
        return res.status(400).send('Misconfigured 2FA Reset Action.');
      }

      if (!this.settings.token) {
        debug('Token field setting missing');
        return res.status(400).send('2FA Reset Action is missing Token Field setting.');
      }

      twoFa.resetTwoFa(
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
            debug('2FA Reset Action Current User Failed');
            return res.status(401).send(err.message);
          }

          next();
        });
      });
    }
  }

  // Return the TwoFaResetAction.
  // Disable editing handler and method settings
  TwoFaResetAction.access = {
    handler: false,
    method: false
  };

  return TwoFaResetAction;
};
