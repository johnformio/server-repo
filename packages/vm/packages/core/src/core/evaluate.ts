import ContextBuilder from './ContextBuider';
import _ from 'lodash';

export type EvaluationDependency = 'lodash' | 'moment' | 'core' | 'instanceShim';

type TransferableValue = string | number | boolean | null | undefined | object;
const isTransferableValue = (value: any): value is TransferableValue => {
  return _.isString(value) || _.isNumber(value) || _.isBoolean(value) || _.isNull(value) || _.isUndefined(value) || _.isObject(value);
}

export type EvaluateOptions = {
  deps?: EvaluationDependency[];
  data?: Record<string, any>;
  code: string;
};

export type EvaluateResult = TransferableValue;

// TODO: Add support for result var, e.g. result = 1 + 1. Right now last expression is returned
export default async function evaluate({
  deps = [],
  data = {},
  code
}: EvaluateOptions): Promise<EvaluateResult> {
  // Create context with dependencies
  const contextBuilder = ContextBuilder.fromDefaultIsolate();
  for (let dep of deps) {
    contextBuilder.withDependency(dep);
  }
  const context = await contextBuilder.build();

  // Transfer data to context
  for (let key of Object.keys(data)) {
    if (!isTransferableValue(data[key])) {
      throw new Error(`${key} is not transferable`);
    }
    await context.global.set(key, data[key], {copy: true});
  }
  // Evaluate code
  const result = await context.eval(code, {copy: true});
  return result;
}
