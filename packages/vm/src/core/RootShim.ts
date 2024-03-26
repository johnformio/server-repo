import { InstanceShim } from './InstanceShim';
import * as FormioCore from '@formio/core';
import { getLastPathnameSegment } from './util.js';

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

    getComponent(pathArg: string) {
        // If we don't have an exact path match, compare the final pathname segment with the path argument for each component
        // i.e. getComponent('foo') should return a component at the path 'bar.foo' if it exists
        if (!this.instanceMap[pathArg]) {
            FormioCore.Utils.eachComponentData(
                this.form.components,
                this.submission.data,
                (
                    component: FormioCore.Component,
                    data: any,
                    row: any,
                    componentPath: string,
                ) => {
                    const lastPathSegment = getLastPathnameSegment(
                        component,
                        componentPath,
                    );
                    if (lastPathSegment === pathArg) {
                        // set a cache for future `getComponent` calls in this lifecycle
                        this.instanceMap[pathArg] =
                            this.instanceMap[componentPath];
                    }
                },
            );
        }
        return this.instanceMap[pathArg];
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
