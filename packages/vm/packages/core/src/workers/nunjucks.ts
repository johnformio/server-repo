import { configure, runtime } from 'nunjucks';
import dateFilter from 'nunjucks-date-filter';
import {
    isString,
    isArray,
    isPlainObject,
    forEach,
    unset as _unset,
} from 'lodash';
import {
    getEmailViewForSubmission,
    renderFormSubmission,
    renderComponentValue,
} from './util';
import macros from './macros';
import { Formio } from '../Formio';
import { evaluateError } from '../util.js';
import { evaluateInVm } from '../evaluateInVm.js';

// Configure nunjucks to not watch any files
const environment = configure([], {
    watch: false,
    autoescape: false,
});

environment.addFilter('is_string', (obj) => isString(obj));

environment.addFilter('is_array', (obj) => isArray(obj));

environment.addFilter('is_object', (obj) => isPlainObject(obj));

environment.addFilter('date', dateFilter);

environment.addFilter('submissionTable', (obj, components, formInstance) => {
    const view = formInstance
        ? getEmailViewForSubmission(formInstance)
        : renderFormSubmission(obj, components);

    return new runtime.SafeString(view);
});

environment.addFilter('componentValue', (obj, key, components) => {
    const compValue = renderComponentValue(obj, key, components);
    return new runtime.SafeString(compValue.value);
});

environment.addFilter('componentLabel', (key, components) => {
    if (!components.hasOwnProperty(key)) {
        return key;
    }

    const component = components[key];
    return component.label || component.placeholder || component.key;
});

const getScript = (data: any) => {
    if (isString(data)) {
        // Script to render a single string.
        return `
      environment.params = context;
      output = environment.renderString(context.sanitize(input), context);
    `;
    }

    // Script to render an object of properties.
    return `
    environment.params = context;
    var rendered = {};
    for (let prop in input) {
      if (input.hasOwnProperty(prop)) {
        rendered[prop] = input[prop];
        if (prop === 'html') {
          rendered[prop] = environment.renderString(context.macros + context.sanitize(rendered[prop]), context);
        }
        rendered[prop] = environment.renderString(context.macros + context.sanitize(rendered[prop]), context);
      }
    }
    output = rendered;
  `;
};

export const task = (worker: any) => {
    const { render, context = {} } = worker;

    if (context._private) {
        delete context._private;
    }

    context.macros = macros;
    context.sanitize = (input: string) =>
        input.replace(
            /{{(.*(\.constructor|\]\().*)}}/g,
            '{% raw %}{{$1}}{% endraw %}'
        );

    let renderMethod = 'static';
    if (process.env.RENDER_METHOD) {
        renderMethod = process.env.RENDER_METHOD;
    } else if (render && render.renderingMethod) {
        renderMethod = render.renderingMethod;
    }
    if (renderMethod === 'static') {
        try {
            const script = getScript(render);
            return Promise.resolve(
                evaluateInVm(
                    script,
                    { output: typeof render === 'string' ? '' : {} },
                    { context, environment, input: render },
                    'output',
                    {
                        timeout: 15000,
                        microtaskMode: 'afterEvaluate',
                    }
                )
            );
        } catch (err: unknown) {
            return Promise.resolve(evaluateError(err));
        }
    }

    const unsets: any[] = [];
    const conditionallyInvisibleComponents: any[] = [];
    let unsetsEnabled = false;

    // TODO: why use premium if formio-workers doesn't even include it?
    // try {
    //     if (premium) {
    //         Formio.use(premium);
    //     }
    // } catch {} // Skip connecting premium components if this file does not exist

    return Formio.createForm(context.form, {
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
                    self.component.hasOwnProperty('persistent') &&
                    (!self.component.persistent ||
                        self.component.persistent === 'client-only')
                ) {
                    unsets.push({ key, data });
                }
                // Check if this component is conditionally hidden and does not set clearOnHide to false.
                else if (
                    (!self.component.hasOwnProperty('clearOnHide') ||
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
    }).then((form: any) => {
        // Set the submission data
        form.data = context.data;

        // Perform calculations and conditions.
        form.checkConditions();
        form.calculateValue();

        // Reset the data
        form.data = {};

        // Set the value to the submission.
        unsetsEnabled = true;
        form.setValue(
            {
                data: context.data,
            },
            {
                sanitize: true,
            }
        );

        // Check the visibility of conditionally visible components after unconditionally visible
        forEach(
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

        unsets.forEach((unset) => _unset(unset.data, unset.key));

        context.formInstance = form;
        const readable = {
            input: render,
            environment,
            context,
        };
        const writable = {
            output: typeof render === 'string' ? '' : {},
        };

        try {
            return evaluateInVm(
                getScript(render),
                writable,
                readable,
                'output',
                { timeout: 15000, microtaskMode: 'afterEvaluate' }
            );
        } catch (err: unknown) {
            return Promise.resolve(evaluateError);
        }
    });
};
