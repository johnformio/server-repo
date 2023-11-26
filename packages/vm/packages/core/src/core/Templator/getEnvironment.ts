import { configure, runtime } from 'nunjucks';
import dateFilter from 'nunjucks-date-filter';
import { isString, isArray, isPlainObject } from 'lodash';
import {
    getEmailViewForSubmission,
    renderFormSubmission,
    renderComponentValue,
} from './util';

export function getEnvironment() {
    // Configure nunjucks to not watch any files
    const environment = configure([], {
        watch: false,
        autoescape: false,
    });

    environment.addFilter('is_string', (obj) => isString(obj));

    environment.addFilter('is_array', (obj) => isArray(obj));

    environment.addFilter('is_object', (obj) => isPlainObject(obj));

    environment.addFilter('date', dateFilter);

    environment.addFilter(
        'submissionTable',
        (obj, components, formInstance) => {
            const view = formInstance
                ? getEmailViewForSubmission(formInstance)
                : renderFormSubmission(obj, components);

            return new runtime.SafeString(view);
        }
    );

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

    return environment;
}
