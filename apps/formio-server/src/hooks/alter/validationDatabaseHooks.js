'use strict';

const validateCaptcha = (tokenModel, captchaToken) => {
    return new Promise((resolve, reject) => {
        tokenModel.findOne({value: captchaToken}, (err, token) => {
        if (err) {
          return reject(err);
        }

        if (!token) {
          return resolve(false);
        }

        // Remove temp token after submission with Captcha
        return token.remove(() => resolve(true));
      });
    });
};

module.exports = app =>  (hooks,validator) => {
    hooks.validateCaptcha = validateCaptcha.bind(validator, validator.tokenModel);
    return hooks;
};
