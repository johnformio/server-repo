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
                compPath: any,
                components: any,
                index: any,
                parent: any,
                paths: FormioCore.ComponentPaths,
            ) => {
                const {
                    path,
                    fullPath,
                    fullLocalPath,
                    dataPath,
                    localDataPath,
                } = paths;
                const instance = new InstanceShim(
                    component,
                    this,
                    submission.data,
                    dataPath ?? path ?? component.key,
                    index,
                );
                this.components.push(instance);
                if (path && !this.instanceMap[path]) {
                    this.instanceMap[path] = instance;
                }
                if (fullPath && !this.instanceMap[fullPath]) {
                    this.instanceMap[fullPath] = instance;
                }
                if (fullLocalPath && !this.instanceMap[fullLocalPath]) {
                    this.instanceMap[fullLocalPath] = instance;
                }
                if (dataPath && !this.instanceMap[dataPath]) {
                    this.instanceMap[dataPath] = instance;
                }
                if (localDataPath && !this.instanceMap[localDataPath]) {
                    this.instanceMap[localDataPath] = instance;
                }
            },
            true,
        );
    }

    getComponent(pathArg: string | string[]) {
        const path = FormioCore.Utils.getStringFromComponentPath(pathArg);
        // If we don't have an exact path match, compare the final pathname segment with the path argument for each component
        // i.e. getComponent('foo') should return a component at the path 'bar.foo' if it exists
        if (!this.instanceMap[path]) {
            for (const key in this.instanceMap) {
                const match = key.match(new RegExp(`\\.${path}$`));
                const lastPathSegment = match ? match[0].slice(1) : '';
                if (lastPathSegment === path) {
                    // set a cache for future `getComponent` calls in this lifecycle
                    this.instanceMap[path] = this.instanceMap[key];
                    break;
                }
            }
        }
        return this.instanceMap[path];
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
