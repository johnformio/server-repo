import _ from 'lodash';
import debug from 'debug';

import { evaluateInVm } from '../core';
import { Validator } from '../core/Validator';

import { Form, Submission } from '../types';

type ValidateConfig = {
    token?: string;
    decodedToken?: any;
};

type ValidateArgs = {
    form: Form;
    submission: Submission;
};

export async function validate(args: ValidateArgs, config: ValidateConfig) {
    const { form, submission } = args;
    const { token, decodedToken } = config;

    const validator = new Validator(form, token, decodedToken);
    const result = await validator.validate(submission);
    return result;
}
