import _ from 'lodash';
import moment from 'moment';
const FormioUtils = require('formiojs/utils').default;

export function isAutoAddress(data: any, component: any, path?: string) {
    if (component.type !== 'address') {
        return false;
    }
    var addressData = _.get(data, path || component.key);
    if (!addressData) {
        return true;
    }
    return !addressData.mode || addressData.mode === 'autocomplete';
}

export function flattenComponentsForRender(data: any, components: any) {
    const flattened: any = {};
    FormioUtils.eachComponent(
        components,
        (component: any, path: string) => {
            var hasColumns =
                component.columns && Array.isArray(component.columns);
            var hasRows = component.rows && Array.isArray(component.rows);
            var hasComps =
                component.components && Array.isArray(component.components);
            var autoAddress = isAutoAddress(data, component, path);
            var isDataArray =
                ['datagrid', 'editgrid'].includes(component.type) ||
                component.tree;

            // Address compoennt with manual mode disabled should not show the nested components.
            if (autoAddress) {
                hasComps = false;
            }

            if (!isDataArray && (hasColumns || hasRows || hasComps)) {
                return;
            }

            // Containers will get rendered as flat.
            if (
                component.type === 'container' ||
                component.type === 'button' ||
                component.type === 'hidden'
            ) {
                return;
            }

            flattened[path] = component;
            if (autoAddress) {
                return true;
            }

            if (isDataArray) {
                return true;
            }
        },
        true
    );
    return flattened;
}

export function renderFormSubmission(data: any, components: any) {
    const comps: any[] = flattenComponentsForRender(data, components);
    let submission = '<table border="1" style="width:100%">';
    _.each(comps, (component: any, key: string) => {
        const cmpValue = renderComponentValue(data, key, comps);
        if (typeof cmpValue.value === 'string') {
            submission += '<tr>';
            submission += `<th style="padding: 5px 10px;">${cmpValue.label}</th>`;
            submission += `<td style="width:100%;padding:5px 10px;">${cmpValue.value}</td>`;
            submission += '</tr>';
        }
    });
    submission += '</table>';
    return submission;
}

export function getEmailViewForSubmission(formInstance: any) {
    return formInstance.getView(formInstance.data, {
        email: true,
    });
}

/**
 * Renders a specific component value, which is also able
 * to handle Containers, Data Grids, as well as other more advanced
 * components such as Signatures, Dates, etc.
 *
 * @param data
 * @param key
 * @param components
 * @returns {{label: *, value: *}}
 */
/* eslint-disable max-statements */
export function renderComponentValue(
    data: any,
    key: string,
    components: any,
    noRecurse?: boolean
): any {
    const component: any = components[key];
    let value = _.get(data, key);

    if (
        component &&
        component.type === 'checkbox' &&
        component.inputType === 'radio' &&
        component.name
    ) {
        const pathToComponentData = key.slice(0, -component.key.length);
        const formattedPath = pathToComponentData.length
            ? pathToComponentData.slice(0, -1)
            : '';
        const compContextData = formattedPath
            ? _.get(data, formattedPath)
            : data;
        const savedValue = _.get(compContextData, component.name);

        value = !!savedValue && _.isEqual(savedValue, component.value);
    }

    if (!value) {
        value = '';
    }

    const compValue = {
        label: key,
        value,
    };

    if (!components.hasOwnProperty(key)) {
        return compValue;
    }

    // For address components, we need to get the address parts.
    if (
        !noRecurse &&
        component.parent &&
        component.parent.type === 'address' &&
        component.parent.enableManualMode &&
        !isAutoAddress(data, component.parent)
    ) {
        return renderComponentValue(
            _.get(data, component.parent.key).address,
            key,
            components,
            true
        );
    }

    compValue.label = component.label || component.placeholder || component.key;
    if (component.multiple) {
        components[key].multiple = false;
        compValue.value = _.map(value, (subValue) => {
            const subValues: any = {};
            subValues[key] = subValue;
            return renderComponentValue(subValues, key, components).value;
        }).join(', ');
        return compValue;
    }

    switch (component.type) {
        case 'password':
            compValue.value = '--- PASSWORD ---';
            break;
        case 'address':
            if (
                compValue.value &&
                compValue.value.mode &&
                compValue.value.address
            ) {
                compValue.value = compValue.value.address;
            }
            compValue.value = compValue.value
                ? compValue.value.formatted_address
                : '';
            break;
        case 'signature':
            // For now, we will just email YES or NO until we can make signatures work for all email clients.
            compValue.value =
                _.isString(value) && value.startsWith('data:') ? 'YES' : 'NO';
            break;
        case 'container':
            compValue.value = '<table border="1" style="width:100%">';
            _.each(value, (subValue, subKey) => {
                const subCompValue = renderComponentValue(
                    value,
                    subKey,
                    components
                );
                if (_.isString(subCompValue.value)) {
                    compValue.value += '<tr>';
                    compValue.value += `<th style="text-align:right;padding: 5px 10px;">${subCompValue.label}</th>`;
                    compValue.value += `<td style="width:100%;padding:5px 10px;">${subCompValue.value}</td>`;
                    compValue.value += '</tr>';
                }
            });
            compValue.value += '</table>';
            break;
        case 'editgrid':
        case 'datagrid': {
            const columns = flattenComponentsForRender(
                data,
                component.components
            );
            compValue.value = '<table border="1" style="width:100%">';
            compValue.value += '<tr>';
            _.each(columns, (column) => {
                const subLabel = column.label || column.key;
                compValue.value += `<th style="padding: 5px 10px;">${subLabel}</th>`;
            });
            compValue.value += '</tr>';
            _.each(value, (subValue) => {
                compValue.value += '<tr>';
                _.each(columns, (column, key) => {
                    const subCompValue = renderComponentValue(
                        subValue,
                        key,
                        columns
                    );
                    if (typeof subCompValue.value === 'string') {
                        compValue.value += '<td style="padding:5px 10px;">';
                        compValue.value += subCompValue.value;
                        compValue.value += '</td>';
                    }
                });
                compValue.value += '</tr>';
            });
            compValue.value += '</table>';
            break;
        }
        case 'datetime': {
            const dateFormat =
                (component.widget && component.widget.format) ||
                component.format ||
                'yyyy-MM-dd hh:MM a';
            compValue.value = moment(value).format(
                FormioUtils.convertFormatToMoment(dateFormat)
            );
            break;
        }
        case 'radio':
        case 'select': {
            let values = [];
            if (component.hasOwnProperty('values')) {
                values = component.values;
            } else if (
                component.hasOwnProperty('data') &&
                component.data.values
            ) {
                values = component.data.values;
            }
            for (const i in values) {
                const subCompValue = values[i];
                if (subCompValue.value === value) {
                    compValue.value = subCompValue.label;
                    break;
                }
            }
            break;
        }
        case 'selectboxes': {
            const selectedValues = [];
            for (const j in component.values) {
                const selectBoxValue = component.values[j];
                if (value[selectBoxValue.value]) {
                    selectedValues.push(selectBoxValue.label);
                }
            }
            compValue.value = selectedValues.join(',');
            break;
        }
        case 'file': {
            const file = Array.isArray(compValue.value)
                ? compValue.value[0]
                : compValue.value;
            if (file) {
                // eslint-disable-next-line max-len
                compValue.value = `<a href="${file.url}" target="_blank" download="${file.originalName}">${file.originalName}</a>`;
            } else {
                compValue.value = '';
            }
            break;
        }
        case 'survey': {
            compValue.value = '<table border="1" style="width:100%">';

            compValue.value += `
          <thead>
            <tr>
              <th>Question</th>
              <th>Value</th>
            </tr>
          </thead>
        `;

            compValue.value += '<tbody>';
            _.forIn(value, (value, key) => {
                const question = _.find(component.questions, ['value', key]);
                const answer = _.find(component.values, ['value', value]);

                if (!question || !answer) {
                    return;
                }

                compValue.value += '<tr>';
                compValue.value += `<td style="text-align:center;padding: 5px 10px;">${question.label}</td>`;
                compValue.value += `<td style="text-align:center;padding: 5px 10px;">${answer.label}</td>`;
                compValue.value += '</tr>';
            });
            compValue.value += '</tbody></table>';

            break;
        }
        default:
            if (!component.input) {
                return { value: false };
            }
            break;
    }

    if (component.protected) {
        compValue.value = '--- PROTECTED ---';
    }

    // Ensure the value is a string.
    compValue.value = compValue.value
        ? _.isObject(compValue.value)
            ? JSON.stringify(compValue.value)
            : compValue.value.toString()
        : '';

    return compValue;
}
