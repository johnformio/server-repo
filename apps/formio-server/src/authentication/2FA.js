"use strict";
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const _ = require("lodash");
const bcrypt = require('bcrypt');

module.exports = function(router) {
  /**
   * Create a 2FA code
   *
   * @returns {*}
   */
  function getTwoFactorAuthenticationCode() {
    const secretCode = speakeasy.generateSecret({
      name: router.config.twoFactorAuthAppName,
    });
    return {
      otpauthUrl: secretCode.otpauth_url,
      base32: secretCode.base32,
    };
  }

  /**
   * Respond with QR code image
   * @param data {String}
   * @param res
   * @param next {Function}
   * @returns {*}
   */
  function respondWithQRCode(data, res, next) {
    QRCode.toDataURL(data, (err, url) => {
      if (err) {
        return next(err);
      }
      return res.status(200).send(url);
    });
  }

   /**
   * Generate 2FA Code for the current user
   * @param req
   * @param res
   * @param next {Function}
   * @returns {*}
   */
  async function generateTwoFactorAuthenticationCode(req, res, next) {
    const user = req.user;
    if (!user) {
      return next("Missing User");
    }
    const {otpauthUrl, base32} = getTwoFactorAuthenticationCode();
    try {
      await router.formio.mongoose.models.submission.updateOne(
        {
          form: user.form,
          _id: user._id,
          deleted: {$eq: null},
        },
        {
          $set: {
            "data.twoFactorAuthenticationCode": base32,
          },
        }
      );
      respondWithQRCode(otpauthUrl, res, next);
    }
    catch (error) {
      return next(error);
    }
  }

  /**
   * Respond with an existing 2FA Code.
   * @param req
   * @param res
   * @param next {Function}
   * @returns {*}
   */
  async function representTwoFactorAuthenticationCode(req, res, next) {
    const user = req.user;
    if (!user) {
      return next("Missing User");
    }

    const {token} = req;
    if (!token || !token.isSecondFactorAuthenticated) {
      return next('2FA Unauthorized');
    }

    const twoFactorAuthenticationCode = _.get(
      user,
      "data.twoFactorAuthenticationCode",
      null
    );

    if (!twoFactorAuthenticationCode) {
      return next("Missing 2FA");
    }

    const otpauthUrl = `otpauth://totp/SecretKey?secret=${twoFactorAuthenticationCode}`;
    respondWithQRCode(otpauthUrl, res, next);
  }

  /**
   * Turn off 2FA for the current user.
   * @param req
   * @param res
   * @param next {Function}
   * @returns {*}
   */
  async function turnOffTwoFactorAuthentication(req, res, next) {
    const {user} = req;
    if (!user) {
      return next("Missing User");
    }

    const {token} = req;

    if (!token || !token.isSecondFactorAuthenticated) {
      return next('2FA Unauthorized');
    }

    try {
      await router.formio.mongoose.models.submission.updateOne(
        {
          form: user.form,
          _id: user._id,
          deleted: {$eq: null},
        },
        {
          $set: {
            "data.twoFactorAuthenticationCode": "",
            "data.twoFactorAuthenticationEnabled": false,
            "data.twoFactorAuthenticationRecoveryCode": "",
          },
        }
      );
    }
    catch (error) {
      return next(error);
    }

    authenticate(req, res, user, (err) => {
      if (err) {
        return next(err);
      }

      return res.status(200).send({success: true});
    }, true);
  }

  /**
   * Verifies 2FA code with user's token.
   * @param userToken {String}
   * @param twoFactorAuthenticationCode {String}
   * @returns {Boolean}
   */
  async function verifyTwoFactorAuthenticationCode(
    userToken,
    twoFactorAuthenticationCode
  ) {
    return speakeasy.totp.verify({
      secret: twoFactorAuthenticationCode,
      encoding: "base32",
      token: userToken,
    });
  }

  /**
   * Turn on 2FA for the current user.
   * @param req
   * @param res
   * @param next {Function}
   * @returns {*}
   */
  async function turnOnTwoFactorAuthentication(req, res, next) {
    let {twoFaCode} = req.body;
    twoFaCode = validateCode(twoFaCode);
    const isDataSource = req.headers["two-fa-datasource"] === "true";

    if (!twoFaCode) {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: "Bad 2FA token",
        });
      }
      return next("Bad 2FA token");
    }

    const user = req.user;
    if (!user) {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: "Unauthorized user",
        });
      }
      return next("Unauthorized user");
    }

    const twoFactorAuthenticationEnabled = _.get(
      user,
      "data.twoFactorAuthenticationEnabled",
      false
    );
    const twoFactorAuthenticationRecoveryCode = _.get(
      user,
      "data.twoFactorAuthenticationRecoveryCode",
      null
    );

    if (twoFactorAuthenticationEnabled && twoFactorAuthenticationRecoveryCode) {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: "2FA has already been turned on.",
        });
      }
      return next("2FA has already been turned on.");
    }

    const twoFactorAuthenticationCode = _.get(
      user,
      "data.twoFactorAuthenticationCode",
      null
    );

    if (!twoFactorAuthenticationCode) {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: "2FA hasn't been set yet.",
        });
      }
      return next("2FA hasn't been set yet.");
    }
    const isCodeValid = await verifyTwoFactorAuthenticationCode(
      twoFaCode,
      twoFactorAuthenticationCode
    );
    if (isCodeValid) {
      const {base32: recoveryCode} = getTwoFactorAuthenticationCode();
      router.formio.encrypt(recoveryCode, async function(err, hash) {
        if (err) {
          if (isDataSource) {
            return res.status(200).send({
              success: false,
              message: err,
            });
          }
          return next(err);
        }

        if (!hash) {
          if (isDataSource) {
            return res.status(200).send({
              success: false,
              message: "2FA didn't set",
            });
          }
          return next("2FA didn't set");
        }

        try {
          await router.formio.mongoose.models.submission.updateOne(
            {
              form: user.form,
              _id: user._id,
              deleted: {$eq: null},
            },
            {
              $set: {
                "data.twoFactorAuthenticationEnabled": true,
                "data.twoFactorAuthenticationRecoveryCode": hash,
              },
            }
          );

          authenticate(req, res, user, (err) => {
            if (err) {
              throw new Error(err);
            }
            return res.status(200).send({success: true, recoveryCode});
          });
        }
        catch (error) {
          if (isDataSource) {
            return res.status(200).send({
              success: false,
              message: error,
            });
          }
          return next(error);
        }
      });
    }
    else {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: "Wrong 2FA Token provided",
        });
      }
      return next("Wrong 2FA Token provided");
    }
  }

  /**
   * Validate user's token.
   * @param token {String}
   * @returns {Boolean}
   */
  function validateCode(token) {
    if (token && typeof token === 'string') {
      token = token.trim();

      if (token.length === 6 && !token.match(/[^0-9]/)) {
        return token;
      }
    }

    return null;
  }

  /**
   * Authentication method.
   * @param req
   * @param res
   * @param user
   * @param next {Function}
   * @param skip {Boolean}
   * @returns {*}
   */
  function authenticate(req, res, user, next, skip = false) {
    router.formio.hook.alter('login', user, req, (err) => {
      if (err) {
        return next(err);
      }

      // Allow anyone to hook and modify the token.
      const oldToken = {...req.token};

      if (skip) {
        delete oldToken.isSecondFactorAuthenticated;
      }
      else {
        oldToken.isSecondFactorAuthenticated = true;
      }

      const token = router.formio.hook.alter('token', {
        ...oldToken,
      }, null, req);

      router.formio.hook.alter('tokenDecode', token, req, (err, decoded) => {
        if (err) {
          return next(err);
        }

        const newToken =  router.formio.auth.getToken(decoded);

        req.user = user;
        req.token = decoded;
        res.token = newToken;
        req['x-jwt-token'] = newToken;
        next();
      });
    });
  }

   /**
   * Authenticate the current user via 2FA.
   * @param req
   * @param res
   * @param next {Function}
   * @returns {*}
   */
  async function secondFactorAuthentication(req, res, twoFaCode, next) {
    twoFaCode = validateCode(twoFaCode);

    if (!twoFaCode) {
      return next('Bad 2FA token');
    }

    const user = req.user;
    if (!user) {
      return next('Unauthorized user');
    }
    const twoFactorAuthenticationCode = _.get(
      user,
      "data.twoFactorAuthenticationCode",
      null
    );

    if (!twoFactorAuthenticationCode) {
      return next('2FA hasn\'t been set yet.');
    }
    const isCodeValid = await verifyTwoFactorAuthenticationCode(
      twoFaCode,
      twoFactorAuthenticationCode
    );
    if (isCodeValid) {
      authenticate(req, res, user, next);
    }
    else {
      return next('Bad 2FA token');
    }
  }

  /**
   * Reset 2FA.
   * @param req
   * @param res
   * @param recoveryCode {String}
   * @param next {Function}
   * @returns {*}
   */
  async function resetTwoFa(req, res, recoveryCode, next) {
    if (!recoveryCode) {
      return next('Bad 2FA token');
    }

    const user = req.user;
    if (!user) {
      return next('Unauthorized user');
    }
    const hash = _.get(
      user,
      "data.twoFactorAuthenticationRecoveryCode",
      null
    );

    if (!hash) {
      return next('2FA hasn\'t been set yet.');
    }

    bcrypt.compare(recoveryCode, hash, async (err, value) => {
      if (err) {
        return next(err);
      }

      if (!value) {
        return next('Recovery code was incorrect.');
      }

      try {
        await router.formio.mongoose.models.submission.updateOne(
          {
            form: user.form,
            _id: user._id,
            deleted: {$eq: null},
          },
          {
            $set: {
              "data.twoFactorAuthenticationEnabled": false,
              "data.twoFactorAuthenticationRecoveryCode": "",
              "data.twoFactorAuthenticationCode": "",
            },
          }
        );
        authenticate(req, res, user, next, true);
      }
      catch (error) {
        return next(error);
      }
    });
  }

  /**
   * Check if the current user authenticated with 2FA if it's enabled.
   * @param req
   * @returns {Boolean}
   */
  function is2FAuthenticated(req) {
    const isSecondFactorAuthenticated = _.get(req, 'token.isSecondFactorAuthenticated', true);
		const twoFactorAuthenticationCode = _.get(req, "user.data.twoFactorAuthenticationCode", null);
		const twoFactorAuthenticationEnabled = _.get(req, "user.data.twoFactorAuthenticationEnabled", false);

    if (!isSecondFactorAuthenticated && twoFactorAuthenticationCode && twoFactorAuthenticationEnabled) {
      return false;
    }

    return true;
  }
  router.post("/2fa/generate", generateTwoFactorAuthenticationCode);
  router.post("/2fa/represent", representTwoFactorAuthenticationCode);
  router.post("/2fa/turn-on", turnOnTwoFactorAuthentication);
  router.post("/2fa/turn-off", turnOffTwoFactorAuthentication);

  return {
    is2FAuthenticated,
    secondFactorAuthentication,
    resetTwoFa
  };
};
