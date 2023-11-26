import { forEach, unset } from 'lodash';
import debug from 'debug';

import { evaluateInVm, evaluateError } from '..';
import { Formio } from '../Formio';
import { getEnvironment } from './getEnvironment';
import { getScript } from './getScript';
import { macros } from './macros';

import { JSON, TemplateData, TemplateFn } from '../../types';

type RenderContext = TemplateData['context'] & {
    macros: typeof macros;
    sanitize: (input: string) => string;
    formInstance?: any;
};

const log = debug('template');

export const template: TemplateFn = async (data) => {
    const { render, context } = data;
    const renderContext: RenderContext = {
        ...context,
        macros,
        sanitize: (input: string) =>
            input.replace(
                /{{(.*(\.constructor|\]\().*)}}/g,
                '{% raw %}{{$1}}{% endraw %}'
            ),
    };

    if (renderContext._private) {
        delete renderContext._private;
    }

    const environment = getEnvironment();
    const renderMethod =
        process.env.RENDER_METHOD || render.renderingMethod || 'static';
    if (renderMethod === 'static') {
        const script = getScript(render);
        return evaluateInVm(
            script,
            { output: typeof render === 'string' ? '' : {} },
            { context: renderContext, environment, input: render },
            'output',
            {
                timeout: 15000,
                microtaskMode: 'afterEvaluate',
                includeLibs: false,
            }
        );
    }

    const unsets: { data: JSON; key: string }[] = [];
    const conditionallyInvisibleComponents: any[] = [];
    let unsetsEnabled = false;

    try {
        const premium = require('@formio/premium/dist/premium-server.min.js');
        if (premium) {
            Formio.use(premium);
        }
    } catch {
        log('Could not find premium components', 'template');
    }
    const form = await Formio.createForm(renderContext.form, {
        server: true,
        noDefaults: true,
        hooks: {
            setDataValue: function (value: JSON, key: string, data: JSON) {
                if (!unsetsEnabled) {
                    return value;
                }

                log('Unsetting values...', 'template');
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
    // Set the submission data
    form.data = renderContext.data;

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
    forEach(conditionallyInvisibleComponents, ({ component, key, data }) => {
        if (!component.conditionallyVisible() || !component.parentVisible) {
            unsets.push({ key, data });
        }
    });

    unsets.forEach((item) => unset(item.data, item.key));

    renderContext.formInstance = form;
    const readable = {
        input: render,
        environment,
        context: renderContext,
    };
    const writable = {
        output: typeof render === 'string' ? '' : {},
    };

    return evaluateInVm(getScript(render), writable, readable, 'output', {
        timeout: 15000,
        microtaskMode: 'afterEvaluate',
        includeLibs: false,
    });
};
