'use strict';
import _ from 'lodash';
import debug from 'debug';

import { evaluateInVm } from './evaluateInVm';
import { Formio } from './Formio';
import { Form, Submission } from './types';

const validatorLog = debug('vm:validator');

export class Validator {
    form: {
        components: any[];
        module?: any;
    };
    token?: string;
    constructor(form: Form, token?: string, decodedToken?: string) {
        this.form = form;
        this.token = token;

        const self = this;
        const evalContext =
            Formio.Components.components.component.prototype.evalContext;
        Formio.Components.components.component.prototype.evalContext =
            function (additional: any) {
                return evalContext.call(this, self.evalContext(additional));
            };

        // Change Formio.getToken to return the server decoded token.
        const getToken = Formio.getToken;
        Formio.getToken = (options: any) => {
            return options.decode ? decodedToken : getToken(options);
        };
    }

    evalContext(context: any) {
        context = context || {};
        context.form = this.form;
        const form = context.form;
        if (form.module && typeof form.module === 'string') {
            try {
                let formModule = null;
                const writableContext = {
                    formModule: null,
                    form,
                };
                const readableContext = {};

                formModule = evaluateInVm(
                    `formModule = ${form.module}`,
                    writableContext,
                    readableContext,
                    'formModule',
                    {
                        timeout: 250,
                        microtaskMode: 'afterEvaluate',
                    }
                );
                if (formModule) {
                    form.module = formModule;
                }
            } catch (err) {
                console.warn(err);
            }
            if (
                form.module.options &&
                form.module.options.form &&
                form.module.options.form.evalContext
            ) {
                // Add the module eval context to the execution script.
                context = Object.assign(
                    context,
                    form.module.options.form.evalContext
                );
            }
        }
        return context;
    }

    /**
     * Validate a submission for a form.
     *
     * @param {Object} submission
     *   The data submission object.
     * @param next
     *   The callback function to pass the results.
     */
    /* eslint-disable max-statements */
    async validate(submission: Submission) {
        validatorLog('Starting validation');

        // Skip validation if no data is provided.
        if (!submission.data) {
            validatorLog('No data, skipping validation');
            return { error: null };
        }

        const unsets: any[] = [];
        const conditionallyInvisibleComponents: any[] = [];
        const emptyData = _.isEmpty(submission.data);
        let unsetsEnabled = false;

        // TODO: figure out what to do with recaptcah validation
        // const { validateReCaptcha } = this;

        // Create the form, then check validity.
        const form = await Formio.createForm(this.form, {
            server: true,
            noDefaults: true,
            hooks: {
                setDataValue: function (value: any, key: string, data: any) {
                    if (!unsetsEnabled) {
                        return value;
                    }

                    const self = this as any;

                    // Check if this component is not persistent.
                    if (
                        self.component.persistent != null &&
                        (!self.component.persistent ||
                            self.component.persistent === 'client-only')
                    ) {
                        unsets.push({ key, data });
                    }
                    // Check if this component is conditionally hidden and does not set clearOnHide to false.
                    else if (
                        (self.component.clearOnHide == null ||
                            self.component.clearOnHide) &&
                        (!self.conditionallyVisible() || !self.parentVisible)
                    ) {
                        conditionallyInvisibleComponents.push({
                            component: this,
                            key,
                            data,
                        });
                    } else if (
                        self.component.type === 'password' &&
                        value === self.defaultValue
                    ) {
                        unsets.push({ key, data });
                    }
                    return value;
                },
            },
        });

        // Set the validation config.
        form.validator.config = {
            token: this.token,
            form: this.form,
            submission,
        };

        // Set the submission data
        form.data = submission.data;

        // Reset the data
        form.data = {};

        form.setValue(submission, {
            sanitize: !form.allowAllSubmissionData,
        });

        // Perform calculations and conditions.
        form.checkConditions();
        form.clearOnHide();
        form.calculateValue();

        // Set the value to the submission.
        unsetsEnabled = true;

        // Check the visibility of conditionally visible components after unconditionally visible
        _.forEach(
            conditionallyInvisibleComponents,
            ({ component, key, data }) => {
                if (
                    !component.conditionallyVisible() ||
                    !component.parentVisible
                ) {
                    unsets.push({ key, data });
                }
            }
        );

        // Check the validity of the form.
        const isValid = await form.checkAsyncValidity(null, true);

        if (isValid) {
            // Clear the non-persistent fields.
            unsets.forEach((unset) => _.unset(unset.data, unset.key));
            if (
                form.form.display === 'wizard' &&
                (form.prefixComps.length || form.suffixComps.length)
            ) {
                submission.data = emptyData
                    ? {}
                    : { ...submission.data, ...form.data };
            } else {
                submission.data = emptyData ? {} : form.data;
            }
            const visibleComponents = (form.getComponents() || []).map(
                (comp: any) => comp.component
            );
            return { error: null, data: submission.data, visibleComponents };
        }

        if (form.form.display === 'wizard') {
            // Wizard errors object contains all wizard errors only on last page
            form.page = form.pages.length - 1;
        }

        const details: any[] = [];
        form.errors.forEach((error: any) =>
            error.messages.forEach((message: any) => details.push(message))
        );

        // Return the validation errors.
        return {
            data: submission.data,
            error: { name: 'ValidationError', details },
        };
    }
}
