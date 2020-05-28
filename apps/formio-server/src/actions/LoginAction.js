'use strict';

const _ = require('lodash');

const LOG_EVENT = 'Login Action';

module.exports = (router, BaseLoginAction) => {
  const debug = require('debug')('formio:action:login');
  const ecode = router.formio.util.errorCodes;
  const logOutput = router.formio.log || debug;
  const log = (...args) => logOutput(LOG_EVENT, ...args);

  /**
   * AuthAction class.
   *   This class is used to create the Authentication action.
   */
  class LoginAction extends BaseLoginAction {
    /**
     * Checks the login attempts for a certain login.
     *
     * @param user
     * @param next
     * @returns {*}
     */
    /* eslint-disable max-statements */
    checkAttempts(error, req, user, next) {
      if (!user || !user._id) {
        return next(error);
      }

      const allowedAttempts = parseInt(this.settings.allowedAttempts, 10);
      if ((Number.isNaN(allowedAttempts) || allowedAttempts === 0) && error) {
        return next(error);
      }

      const {
        session,
      } = req;

      const now = Date.now();
      const lastAttempt = session.lastLoginAttemptAt || 0;

      // See if the login is locked.
      if (session.locked) {
        // Get how long they must wait to be locked out.
        let lockWait = parseInt(this.settings.lockWait, 10) || 1800;

        // Normalize to milliseconds.
        lockWait *= 1000;

        // See if the time has expired.
        if ((lastAttempt + lockWait) < now) {
          // Reset the locked state and attempts totals.
          session.loginAttempts = 0;
          session.locked = false;
          session.lastLoginAttemptAt = now;
        }
        else {
          const howLong = (lastAttempt + lockWait) - now;
          return next(`You must wait ${this.waitText(howLong / 1000)} before you can login.`);
        }
      }

      session.lastLoginAttemptAt = now;

      if (error && allowedAttempts) {
        let attemptWindow = parseInt(this.settings.attemptWindow, 10) || 30;

        // Normalize to milliseconds.
        attemptWindow *= 1000;

        // Determine the login attempts within a certain window.
        const withinWindow = lastAttempt ? ((lastAttempt + attemptWindow) > now) : false;

        if (withinWindow) {
          const attempts = (session.loginAttempts || 0) + 1;

          // If they exceeded the login attempts.
          if (attempts >= allowedAttempts) {
            const lockWait = parseInt(this.settings.lockWait, 10) || 1800;
            error = `Maximum Login attempts. Please wait ${this.waitText(lockWait)} before trying again.`;
            session.locked = true;
          }

          // Set the login attempts.
          session.loginAttempts = attempts;
        }
        else {
          session.loginAttempts = 1;
        }
      }
      else {
        // If there was no error, then reset the attempts to zero.
        session.loginAttempts = 0;
        session.issuedAt = now;
        session.renewedAt = now;
      }

      session.save().then(
        () => next(error),
        (err) => {
          log(req, ecode.auth.ELOGINCOUNT, err);
          next(ecode.auth.ELOGINCOUNT);
        },
      );
    }
    /* eslint-enable max-statements */
  }

  // Return the LoginAction.
  return LoginAction;
};
