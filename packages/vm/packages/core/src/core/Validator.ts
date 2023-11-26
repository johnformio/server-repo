import _ from 'lodash';

import { evaluateInVm } from '.';
import { Formio } from './Formio';

import { Form, Submission } from '../types';

export class Validator {
    form: Form;
    token?: string;
    constructor(form: Form, token?: string, decodedToken?: string) {
        this.form = form;
        this.token = token;

        const self = this;
        const { evalContext } =
            Formio.Components.components.component.prototype;
        Formio.Components.components.component.prototype.evalContext =
            function (additional: any) {
                return evalContext.call(
                    this,
                    self.getAddtlEvalContext(additional)
                );
            };

        // Change Formio.getToken to return the server decoded token.
        const getToken = Formio.getToken;
        Formio.getToken = (options: any) => {
            return options.decode ? decodedToken : getToken(options);
        };
    }

    getAddtlEvalContext(context: any) {
        context = context || {};
        const form = (context.form = this.form);
        if (form.module && typeof form.module === 'string') {
            try {
                let formModule: {
                    options?: { form?: { evalContext?: any } };
                } | null = null;
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
                        includeLibs: false,
                    }
                );
                if (formModule) {
                    form.module = formModule;
                }
            } catch (err) {
                console.warn(err);
            }
            if (
                form.module &&
                typeof form.module !== 'string' &&
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
        // log('Starting validation', 'validator');

        // Skip validation if no data is provided.
        if (!submission.data) {
            // log('No data, skipping validation', 'validator');
            return { error: null };
        }

        const unsets: { key: string; data: JSON }[] = [];
        const conditionallyInvisibleComponents: any[] = [];
        const emptyData = _.isEmpty(submission.data);
        let unsetsEnabled = false;

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
                (comp: { component: JSON }) => comp.component
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
            visibleComponents: null,
        };
    }
}
