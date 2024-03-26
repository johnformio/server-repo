import { InstanceShim } from './InstanceShim';
import * as FormioCore from '@formio/core';

export class RootShim {
    public instanceMap: any;
    public data: any;
    public components: any[];

    private _form: any;
    private _submission: any;

    constructor(form: any, submission: any) {
        this.instanceMap = {};
        this._form = form;
        this._submission = submission;
        this.data = submission.data;
        this.components = [];
        FormioCore.Utils.eachComponentData(
            form.components,
            submission.data,
            (component: any, data: any, row: any, path: any) => {
                // this.instanceMap[path] = component;
                const componentInstance = new InstanceShim(
                    component,
                    this,
                    submission.data,
                    path,
                );
                this.instanceMap[path] = componentInstance;
                this.components.push(componentInstance);
            },
        );
    }

    getComponent(path: string) {
        if (!this.instanceMap[path]) {
            let match = null;
            FormioCore.Utils.eachComponentData(
                this.form.components,
                this.submission.data,
                (
                    component: FormioCore.Component,
                    data: any,
                    row: any,
                    componentPath: string,
                ) => {
                    const contextualPath =
                        FormioCore.Utils.getContextualRowPath(
                            component,
                            componentPath,
                        );
                    if (contextualPath === path) {
                        match = component;
                        // set a cache for future `getComponent` calls in this lifecycle
                        // TODO: discuss potential memory leaks, bad evaluations downstream
                        this.instanceMap[path] =
                            this.instanceMap[contextualPath];
                    }
                },
            );
            return match;
        }
        return this.instanceMap[path];
    }
    // How getComponent should work for dataGrid childs, which row should be used for dataValue;

    get submission() {
        return this._submission;
    }

    set submission(data: any) {}

    get form() {
        return this._form;
    }

    set form(form: any) {}

    get root() {
        return null;
    }
}

// Note: eachComponentData does not work correctly
// when correspoding component lacks value in the data.
