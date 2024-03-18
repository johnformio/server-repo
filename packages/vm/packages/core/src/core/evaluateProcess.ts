import * as FormioCore from '@formio/core';
import { evaluate } from './evaluate';
import { RootShim } from './RootShim';

const code = `
root = new RootShim(context.form, context.submission);
context.instances = root.instanceMap;
data = context.data;

if (context.form.module) {
  // Wrap with parenthesis to return object, not function
  formModule = eval( '(' + context.form.module + ')');
  evalContext = formModule?.options?.form?.evalContext;

  if (evalContext) {
    evalContextFn = (context) => Object.assign({}, context, evalContext);
    context.evalContext = evalContextFn;
  }
}

context.processors = FormioCore.ProcessTargets.evaluator;
scope = FormioCore.processSync(context);

({ scope, data });
`;

export type EvaluateProcessorsOptions = {
    form: any;
    submission: any;
    scope?: any;
    token?: string;
    timeout?: number;
};

export type EvaluateProcessorsResult = {
    scope: any;
    data: any;
};

export async function evaluateProcess(
    options: EvaluateProcessorsOptions,
): Promise<EvaluateProcessorsResult> {
    const submission = JSON.parse(JSON.stringify(options.submission));
    const evaluateContext = {
        form: options.form,
        components: options.form.components,
        submission: submission,
        data: submission.data,
        scope: options.scope || {},
        config: {
            server: true,
            token: options.token || '',
        },
        options: {
            server: true,
        },
    };
    const result = await evaluate({
        deps: ['lodash', 'core', 'instanceShim', 'moment'],
        data: { context: evaluateContext },
        code,
        timeout: options.timeout,
    });
    return result as EvaluateProcessorsResult;
}

// Does the same as `evaluateProcess`, but omits the call to evaluate
// So it's possible to debug core functions outside of the vm
// Should be used ONLY for development
// Before using this function, make sure that it corresponds to the actual version of `evaluateProcess`
export async function evaluateProcessMocked(
    options: EvaluateProcessorsOptions,
): Promise<EvaluateProcessorsResult> {
    (globalThis as any).moment = require('moment');
    (globalThis as any)._ = require('lodash');
    (globalThis as any).FormioCore = require('@formio/core');
    (globalThis as any).utils = FormioCore.Utils;
    (globalThis as any).util = FormioCore.Utils;

    const submission = JSON.parse(JSON.stringify(options.submission));
    const context: any = {
        form: options.form,
        components: options.form.components,
        submission: submission,
        data: submission.data,
        scope: options.scope || {},
        config: {
            server: true,
            token: options.token || '',
        },
        options: {
            server: true,
        },
    };
    const root = new RootShim(context.form, context.submission);
    context.instances = root.instanceMap;
    const data = context.data;

    if (context.form.module) {
        // Wrap with parenthesis to return object, not function
        const formModule = eval('(' + context.form.module + ')');
        const evalContext = formModule?.options?.form?.evalContext;

        if (evalContext) {
            const evalContextFn = (context: any) =>
                Object.assign({}, context, evalContext);
            context.evalContext = evalContextFn;
        }
    }

    context.processors = FormioCore.ProcessTargets.evaluator;
    const scope = FormioCore.processSync(context);

    return { scope, data };
}
