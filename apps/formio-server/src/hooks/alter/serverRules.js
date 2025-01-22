'use strict';

const {FieldError, ProcessorError} = require('@formio/core');

const shouldValidate = (context) => {
    const {component} = context;
    if (component.type === 'captcha') {
        return true;
    }
    return false;
};

const validateCaptcha = async (context) => {
    const {value, config} = context;
    if (!shouldValidate(context)) {
        return null;
    }

    if (!config || !config.database) {
        throw new ProcessorError("Can't test for captcha success without a database config object");
    }
    try {
        if (!value || !value.token) {
            return new FieldError('CAPTCHA: Token is not specified in submission', context, 'catpcha');
        }
        if (!value.success) {
            return new FieldError('CAPTCHA: Token validation error', context, 'captcha');
        }
        const captchaResult = await config.database?.validateCaptcha(value.token);
        return (captchaResult === true) ? null : new FieldError('CAPTCHA: Response token not found', context, 'captcha');
    }
    catch (err) {
        throw new ProcessorError(err.message || err);
    }
};

const validateCaptchaInfo  = {
    name: 'validateCaptcha',
    process: validateCaptcha,
    shouldProcess: shouldValidate,
};

module.exports = app => (serverRules) => {
    return [...serverRules, validateCaptchaInfo];
};
