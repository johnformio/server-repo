import _ from 'lodash';
import mockBrowserContext from '../mockBrowserContext';
mockBrowserContext();
import * as FormioCore from '@formio/core';

import { RootShim } from './RootShim';

export class InstanceShim {
    public _component: any;
    public _root: any;
    public _data: any;
    public _path: string;
    public _rowIndex: number | null;

    constructor(
        component: any,
        root: any,
        data: any,
        path: string = component.path || component.key,
        dataIndex: number | null = null,
    ) {
        this._component = component;
        this._root = root;
        this._data = data;
        this._path = path;
        this._rowIndex = dataIndex;
    }

    get root() {
        return this._root;
    }

    get rowIndex() {
        return this._rowIndex;
    }

    get component() {
        return this._component;
    }

    // No op
    get schema() {
        return {};
    }

    // No op
    get options() {
        return {};
    }

    get currentForm() {
        return this.root.form;
    }

    // Returns row
    get data() {
        return FormioCore.Utils.getContextualRowData(
            this.component,
            this.component.path,
            this._data,
        );
    }

    // No op
    set data(data: any) {}

    // Returns parent instance
    get parent() {
        return this.root.getComponent(
            this.component.path.replace(/(\.[^.]+)$/, ''),
        );
    }

    // Returns component value
    get dataValue() {
        return _.get(this._data, this._path);
    }

    // Question: Should we allow this?
    // Sets component value
    set dataValue(value: any) {
        _.set(this._data, this._path, value);
    }

    // return component value
    getValue() {
        return this.dataValue;
    }

    // set component value
    setValue(value: any) {
        this.dataValue = value;
    }

    shouldSkipValidation() {
        return false;
    }

    isEmpty() {
        return FormioCore.Utils.isComponentDataEmpty(
            this.component,
            this._data,
            this._path,
        );
    }

    getCustomDefaultValue() {
        if (this.component.customDefaultValue) {
            const evaluationContext = {
                form: this.root.form,
                component: this.component,
                submission: this.root.submission,
                data: this.root.data,
                config: {
                    server: true,
                },
                options: {
                    server: true,
                },
                value: null,
                util: FormioCore.Utils,
                utils: FormioCore.Utils,
            };
            const defaultValue = FormioCore.JSONLogicEvaluator.evaluate(
                this.component.customDefaultValue,
                evaluationContext,
                'value',
            );
            return defaultValue;
        }
    }

    // Do nothing functions.
    on() {}
    off() {}
    render() {
        return '';
    }
    redraw() {}
    ready() {
        return Promise.resolve();
    }
    init() {}
    destroy() {}
    teardown() {}
    attach() {}
    detach() {}
    build() {}
    t(text: any) {
        return text;
    }
    sanitize(dirty: any) {
        return dirty;
    }
    renderString(template: any) {
        return template;
    }
}

export const instanceShimCode = `
${InstanceShim.toString().replace('lodash_1.default', '_')}
${RootShim.toString().replace('InstanceShim_1.', '')}
`;
