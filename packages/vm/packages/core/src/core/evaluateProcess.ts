import evaluate from './evaluate';

const code = `
root = new RootShim(context.form, context.submission);
instances = root.instanceMap;
data = context.data;
context.processors = FormioCore.ProcessTargets.evaluator;
scope = FormioCore.processSync({ ...context, instances });

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

export default async function evaluateProcess(options: EvaluateProcessorsOptions): Promise<EvaluateProcessorsResult> {
  const evaluateContext = {
    form: options.form,
    components: options.form.components,
    submission: options.submission,
    data: options.submission.data,
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