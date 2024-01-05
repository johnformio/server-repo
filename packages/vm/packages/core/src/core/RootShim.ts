import { InstanceShim } from './InstanceShim';
import * as FormioCore from '@formio/core'

export class RootShim {
  public instanceMap: any;
  public data: any;
  
  private _form: any;
  private _submission: any;

  constructor(form: any, submission: any) {
    this.instanceMap = {};
    this._form = form;
    this._submission = submission;
    this.data = submission.data;
    FormioCore.Utils.eachComponentData(form.components, submission.data, (component: any, data: any, row: any, path: any, components: any, index: any) => {
      // this.instanceMap[path] = component;
      this.instanceMap[path] = new InstanceShim(component, this, submission.data, path);
    });
  }

  getComponent(path: string) {
    if (!this.instanceMap[path]) {
      return null;
    }
    // return new InstanceShim(this.instanceMap[path], this, this.data, path);
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