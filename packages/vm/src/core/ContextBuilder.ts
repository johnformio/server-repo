import { Isolate, Context } from 'isolated-vm';
import { dependeciesMap } from './configure';
class ContextBuilder {
    private deps: string[] = [];

    static fromDefaultIsolate(): ContextBuilder {
        return new ContextBuilder(new Isolate({ memoryLimit: 128 }));
    }

    constructor(private isolate: any) {}

    withDefaultDependency(
        dependency: keyof typeof dependeciesMap,
    ): ContextBuilder {
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

    withInjectedDependency(dependency: string): ContextBuilder;
    withInjectedDependency(dependency: string[]): ContextBuilder;
    withInjectedDependency(dependency: string | string[]): ContextBuilder {
        if (Array.isArray(dependency)) {
            this.deps.push(...dependency);
        } else {
            this.deps.push(dependency);
        }
        return this;
    }

    withLodash() {
        return this.withDefaultDependency('lodash');
    }

    withMoment() {
        return this.withDefaultDependency('moment');
    }

    withCore() {
        return this.withDefaultDependency('core');
    }

    withNunjucks() {
        return this.withDefaultDependency('nunjucks');
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
        for (const dep of this.deps) {
            await context.eval(dep);
        }
        return context;
    }

    buildSync(): Context {
        const context = this.createContextSync();
        for (const dep of this.deps) {
            context.evalSync(dep);
        }
        return context;
    }
}

export default ContextBuilder;
