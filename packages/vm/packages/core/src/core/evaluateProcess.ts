import { evaluate } from './evaluate';

const code = `
root = new RootShim(context.form, context.submission);
context.instances = root.instanceMap;
data = context.data;

if (context.form.module) {
  // Wrap with parenthesis to return object, not function
  formModule = eval( '(' + context.form.module + ')');
  evalContext = formModule?.options?.form?.evalContext;
  //evalContextFn = (context) => Object.assign(context, evalContext);
  evalContextFn = (context) => Object.assign({}, context, evalContext);

  if (evalContext) {
    context.evalContext = evalContext;
  }
}

context.processors = FormioCore.ProcessTargets.evaluator;
scope = FormioCore.processSync(context);

({ scope, data });
`

export type EvaluateProcessorsOptions = {
  form: any;
  submission: any;
  scope?: any;
  token?: string;
}

export type EvaluateProcessorsResult = {
  scope: any;
  data: any;
}

export async function evaluateProcess(options: EvaluateProcessorsOptions): Promise<EvaluateProcessorsResult> {
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
    }
  };
  const result = await evaluate({
    deps: [ 'lodash', 'core', 'instanceShim' ],
    data: { context: evaluateContext },
    code,
  });
  return result as EvaluateProcessorsResult;
}