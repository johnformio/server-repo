"use strict";
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const _ = require("lodash");
const bcrypt = require('bcrypt');

const ERRORS = {
  NO_HASH: '2FA didn\'t set.',
  NO_USER: 'Missing User.',
  UNAUTHORIZED: '2FA Unauthorized.',
  NO_2FA: 'Missing 2FA.',
  BAD_TOKEN: 'Bad 2FA token.',
  UNAUTHORIZED_USER: 'Unauthorized user.',
  ALREADY_ENABLED: '2FA has already been turned on.',
  NOT_SET_2FA: '2FA hasn\'t been set yet.',
  WRONG_TOKEN: 'Wrong 2FA Token provided.',
  INCORRECT_RECOVERY: 'Recovery code was incorrect.'
};

module.exports = function(router) {
  /**
   * Create a 2FA code
   *
   * @returns {*}
   */
  function getTwoFactorAuthenticationCode(email = '') {
    const sufix = email ? ` (${email})` : '';
    const secretCode = speakeasy.generateSecret({
      name: `${router.config.twoFactorAuthAppName}${sufix}`,
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
      return next(ERRORS.NO_USER);
    }

    const {token} = req;

    if (!token || !is2FAuthenticated(req)) {
      return next(ERRORS.UNAUTHORIZED);
    }

    const twoFactorAuthenticationEnabled = _.get(
      user,
      "data.twoFactorAuthenticationEnabled",
      false
    );
    const twoFactorAuthenticationRecoveryCodes = _.get(
      user,
      "data.twoFactorAuthenticationRecoveryCodes",
      null
    );

    if (
      twoFactorAuthenticationEnabled
      && twoFactorAuthenticationRecoveryCodes
      && Array.isArray(twoFactorAuthenticationRecoveryCodes)
      ) {
      return next(ERRORS.ALREADY_ENABLED);
    }

    const {otpauthUrl, base32} = getTwoFactorAuthenticationCode(user.data.email);

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

      // Return a sectret key for tests
      if (process.env.TEST_SUITE) {
        return res.status(200).send(base32);
      }

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
      return next(ERRORS.NO_USER);
    }

    const {token} = req;
    if (!token || !is2FAuthenticated(req)) {
      return next(ERRORS.UNAUTHORIZED);
    }

    const twoFactorAuthenticationCode = _.get(
      user,
      "data.twoFactorAuthenticationCode",
      null
    );

    if (!twoFactorAuthenticationCode) {
      return next(ERRORS.NO_2FA);
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
      return next(ERRORS.NO_USER);
    }

    const {token} = req;

    if (!token || !is2FAuthenticated(req)) {
      return next(ERRORS.UNAUTHORIZED);
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
            "data.twoFactorAuthenticationRecoveryCodes": [],
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
          message: ERRORS.BAD_TOKEN,
        });
      }
      return next(ERRORS.BAD_TOKEN);
    }

    const user = req.user;
    if (!user) {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: ERRORS.UNAUTHORIZED_USER,
        });
      }
      return next(ERRORS.UNAUTHORIZED_USER);
    }

    const twoFactorAuthenticationEnabled = _.get(
      user,
      "data.twoFactorAuthenticationEnabled",
      false
    );
    const twoFactorAuthenticationRecoveryCodes = _.get(
      user,
      "data.twoFactorAuthenticationRecoveryCodes",
      null
    );

    if (
      twoFactorAuthenticationEnabled
      && twoFactorAuthenticationRecoveryCodes
      && Array.isArray(twoFactorAuthenticationRecoveryCodes)) {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: ERRORS.ALREADY_ENABLED,
        });
      }
      return next(ERRORS.ALREADY_ENABLED);
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
          message: ERRORS.NOT_SET_2FA,
        });
      }
      return next(ERRORS.NOT_SET_2FA);
    }
    const isCodeValid = await verifyTwoFactorAuthenticationCode(
      twoFaCode,
      twoFactorAuthenticationCode
    );

    if (isCodeValid) {
      const recoveryCodes = [];

      for (let i = 0; i < 10; i++) {
        const {base32: recoveryCode} = getTwoFactorAuthenticationCode();
        recoveryCodes.push(recoveryCode);
      }

      const recoveryHashPromise = recoveryCodes.map((recCode) => {
        return new Promise((resolve, reject) => {
          router.formio.encrypt(recCode, (err, hash) => {
            if (err) {
              return reject();
            }

            if (!hash) {
              return reject(ERRORS.NO_HASH);
            }

            resolve(hash);
          });
        });
      });

      try {
        const recoveryHashCodes = await Promise.all(recoveryHashPromise);

        await router.formio.mongoose.models.submission.updateOne(
          {
            form: user.form,
            _id: user._id,
            deleted: {$eq: null},
          },
          {
            $set: {
              "data.twoFactorAuthenticationEnabled": true,
              "data.twoFactorAuthenticationRecoveryCodes": recoveryHashCodes,
            },
          }
        );

        authenticate(req, res, user, (err) => {
          if (err) {
            throw new Error(err);
          }
          return res.status(200).send({success: true, recoveryCodes});
        });
      }
      catch (error) {
        if (error === ERRORS.NO_HASH) {
          // eslint-disable-next-line max-depth
          if (isDataSource) {
            return res.status(200).send({
              success: false,
              message: ERRORS.NO_HASH,
            });
          }
          return next(ERRORS.NO_HASH);
        }

        if (isDataSource) {
          return res.status(200).send({
            success: false,
            message: error,
          });
        }

        return next(error);
      }
    }
    else {
      if (isDataSource) {
        return res.status(200).send({
          success: false,
          message: ERRORS.WRONG_TOKEN,
        });
      }
      return next(ERRORS.WRONG_TOKEN);
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
        res.setHeader('x-jwt-token', res.token);
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
      return next(ERRORS.BAD_TOKEN);
    }

    const user = req.user;
    if (!user) {
      return next(ERRORS.UNAUTHORIZED_USER);
    }
    const twoFactorAuthenticationCode = _.get(
      user,
      "data.twoFactorAuthenticationCode",
      null
    );

    if (!twoFactorAuthenticationCode) {
      return next(ERRORS.NOT_SET_2FA);
    }
    const isCodeValid = await verifyTwoFactorAuthenticationCode(
      twoFaCode,
      twoFactorAuthenticationCode
    );
    if (isCodeValid) {
      authenticate(req, res, user, next);
    }
    else {
      return next(ERRORS.BAD_TOKEN);
    }
  }

  /**
   * Login with a recovery 2FA code.
   * @param req
   * @param res
   * @param recoveryCode {String}
   * @param next {Function}
   * @returns {*}
   */
  async function loginWithRecoveryCode(req, res, recoveryCode, next) {
    if (!recoveryCode) {
      return next(ERRORS.BAD_TOKEN);
    }

    const user = req.user;
    if (!user) {
      return next(ERRORS.UNAUTHORIZED_USER);
    }
    const hashes = _.get(
      user,
      "data.twoFactorAuthenticationRecoveryCodes",
      []
    );

    if (!hashes || !Array.isArray(hashes) || !hashes.length) {
      return next(ERRORS.NOT_SET_2FA);
    }

    try {
      const comparePromis = hashes.map(hash => bcrypt.compare(recoveryCode, hash));

      const compareResult = await Promise.all(comparePromis);

      const newHashes = hashes.filter((hash, index) => !compareResult[index]);

      if (newHashes.length === hashes.length) {
        return next(ERRORS.INCORRECT_RECOVERY);
      }

      await router.formio.mongoose.models.submission.updateOne(
        {
          form: user.form,
          _id: user._id,
          deleted: {$eq: null},
        },
        {
          $set: {
            "data.twoFactorAuthenticationRecoveryCodes": newHashes,
          },
        }
      );
      authenticate(req, res, user, next);
    }
    catch (error) {
      return next(error);
    }
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

  function errorHandler(err, req, res, next) {
    if (err) {
      return res.status(400).send(err);
    }
    next();
  }

  router.post("/2fa/generate", generateTwoFactorAuthenticationCode, errorHandler);
  router.post("/2fa/represent", representTwoFactorAuthenticationCode, errorHandler);
  router.post("/2fa/turn-on", turnOnTwoFactorAuthentication, errorHandler);
  router.post("/2fa/turn-off", turnOffTwoFactorAuthentication, errorHandler);

  return {
    is2FAuthenticated,
    secondFactorAuthentication,
    loginWithRecoveryCode,
    ERRORS
  };
};
