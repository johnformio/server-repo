import { Isolate, Context } from 'isolated-vm';
import { instanceShimCode } from './InstanceShim';
import { lodashCode } from './deps/lodash';
import { momentCode } from './deps/moment';
import { polyfillCode, aliasesCode, coreCode, fastJsonPatchCode } from './deps/core';
import { nunjucksCode, nunjucksDateFilterCode, nunjucksEnvironmentCode } from './deps/nunjucks';
import { nunjucksUtilsCode } from './deps/nunjucks-utils';

// Dependency name corresponds to list of libraries to load when that dependency is requested
const dependeciesMap: Record<string, string[]> = {
  lodash: [lodashCode],
  moment: [momentCode],
  core: [polyfillCode, coreCode, fastJsonPatchCode, aliasesCode],
  instanceShim: [instanceShimCode],
  nunjucks: [
    nunjucksCode,
    nunjucksDateFilterCode,
    nunjucksEnvironmentCode,
    nunjucksUtilsCode
  ],
};

class ContextBuilder {
  private deps: string[] = [];

  static fromDefaultIsolate(): ContextBuilder {
    return new ContextBuilder(new Isolate({ memoryLimit: 128 }));
  }

  constructor(private isolate: any) {}

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

  withNunjucks() {
    return this.withDependency('nunjucks');
  }

  async createContext(): Promise<Context> {
    const context = await this.isolate.createContext();
    const jail = context.global;
    // Set up a reference to the global object
    await jail.set('global', jail.derefInto());
    await jail.set('log', console.log);
    return context;
  }

  createContextSync(): Context {
    const context = this.isolate.createContextSync();
    const jail = context.global;
    // Set up a reference to the global object
    jail.setSync('global', jail.derefInto());
    jail.setSync('log', console.log);
    return context;
  }

  async build(): Promise<Context> {
    const context = await this.createContext();
    for (let dep of this.deps) {
      await context.eval(dep);
    }
    return context;
  }

  buildSync(): Context {
    const context = this.createContextSync();
    for (let dep of this.deps) {
      context.evalSync(dep);
    }
    return context;
  }
}

export default ContextBuilder;
