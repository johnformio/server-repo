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
            (
                component: FormioCore.Component,
                data: any,
                row: any,
                path: any,
            ) => {
                if (!this.instanceMap[path]) {
                    this.instanceMap[path] = new InstanceShim(
                        component,
                        this,
                        submission.data,
                        path,
                    );
                    this.components.push(this.instanceMap[path]);
                }
            },
            undefined,
            undefined,
            undefined,
            true,
        );
    }

    getComponent(pathArg: string) {
        // If we don't have an exact path match, compare the final pathname segment with the path argument for each component
        // i.e. getComponent('foo') should return a component at the path 'bar.foo' if it exists
        if (!this.instanceMap[pathArg]) {
            for (const key in this.instanceMap) {
                const match = key.match(new RegExp(`\\.${pathArg}$`));
                const lastPathSegment = match ? match[0].slice(1) : '';
                if (lastPathSegment === pathArg) {
                    // set a cache for future `getComponent` calls in this lifecycle
                    this.instanceMap[pathArg] = this.instanceMap[key];
                    break;
                }
            }
        }
        return this.instanceMap[pathArg];
    }

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
