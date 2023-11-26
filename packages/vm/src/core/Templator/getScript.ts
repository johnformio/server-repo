import { isString } from 'lodash';
import { TemplateData } from '../../types';

export const getScript = (data: string | TemplateData['render']): string => {
    if (isString(data)) {
        // Script to render a single string.
        return `environment.params = context;
            output = environment.renderString(context.sanitize(input), context);`;
    }

    // Script to render an object of properties.
    return `environment.params = context;
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
        output = rendered;`;
};
