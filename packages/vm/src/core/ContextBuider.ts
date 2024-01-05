import fs from 'fs';
import { Isolate, Context } from 'isolated-vm';
import { instanceShimCode } from './InstanceShim';

const lodashCode = fs.readFileSync('./node_modules/lodash/lodash.min.js', 'utf8');
const momentCode = fs.readFileSync('./node_modules/moment/min/moment.min.js', 'utf8');
const coreCode = fs.readFileSync('./node_modules/@formio/core/dist/formio.core.min.js', 'utf8');
const globalCode = `
var Text              = class {};
var HTMLElement       = class {};
var HTMLCanvasElement = class {};
var navigator         = {userAgent: ''};
var document          = {
  createElement: () => ({}),
  cookie: '',
  getElementsByTagName: () => [],
  documentElement: {
    style: [],
    firstElementChild: {appendChild: () => {}}
  }
};
var window = {addEventListener: () => {}, Event: function() {}, navigator: global.navigator};
var btoa = (str) => {
  return (str instanceof Buffer) ?
    str.toString('base64') :
    Buffer.from(str.toString(), 'binary').toString('base64');
};
//var setTimeout = () => {};
var self = global;
`;

// Dependency name corresponds to list of libraries to load when that dependency is requested
const dependeciesMap: Record<string, string[]> = {
  lodash: [lodashCode],
  moment: [momentCode],
  core: [globalCode, coreCode],
  instanceShim: [instanceShimCode],
};

class ContextBuilder {
  private _isolate: Isolate;
  private deps: string[] = [];

  static fromDefaultIsolate(): ContextBuilder {
    return new ContextBuilder(new Isolate({ memoryLimit: 128 }));
  }

  constructor(isolate: any) {
    this._isolate = isolate;
  }

  withDependency(dependency: string): ContextBuilder {
    if (!dependeciesMap[dependency]) {
      throw new Error(`Dependency ${dependency} not found`);
    }
    if (Array.isArray(dependeciesMap[dependency])) {
      dependeciesMap[dependency].forEach((code) => {
        this.deps.push(code);
      });
      return this;
    }
    throw new Error(`Dependency ${dependency} not found`);
  }

  withLodash() {
    return this.withDependency('lodash');
  }

  withMoment() {
    return this.withDependency('moment');
  }

  withCore() {
    return this.withDependency('core');
  }

  async createContext(): Promise<Context> {
    const context = this._isolate.createContextSync();
    const jail = context.global;
    // Set up a reference to the global object
    jail.setSync('global', jail.derefInto());
    return context;
  }

  async build(): Promise<Context> {
    const context = await this.createContext();
    for (let dep of this.deps) {
      await context.eval(dep);
    }
    return context;
  }
}

export default ContextBuilder;
