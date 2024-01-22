import { EvaluateOptions, EvaluateResult } from './core/evaluate';
import { EvaluateProcessorsOptions, EvaluateProcessorsResult } from './core/evaluateProcess';
import * as lib from './lib';
import * as requests from './requests';
import { Expand } from './types';

enum ModuleType {
  Server,
  Lib,
}
function getModuleType(): ModuleType {
  return ModuleType.Lib;
}

/**
 * Evaluates the given code using either library module or REST API module. The module type is determined automatically.
 *
 * @param {EvaluationDependency[]} [options.deps] - The dependencies to load. Some available dependencies are: lodash, moment, core, instanceShim.
 * @param {string} options.code - The code to evaluate.
 * @param {Record<string, any>} [options.data] - The data to transfer to the evaluation context.
 * @returns {Promise<EvaluateResult>} The result of the evaluation. Can't be a function or contain functions.
 * @throws {Error} Will throw an error if evaluation fails or if the module type is unknown.
 */
export function evaluate(options: Expand<EvaluateOptions>): Promise<EvaluateResult> {
  if (getModuleType() === ModuleType.Server) {
    return requests.evaluate(options);
  }
  else if (getModuleType() === ModuleType.Lib) {
    return lib.evaluate(options);
  }
  throw new Error('Unknown module type');
}

/**
 * Evaluates the given code synchronously using library module.
 *
 * @param {EvaluationDependency[]} [options.deps] - The dependencies to load. Some available dependencies are: lodash, moment, core, instanceShim.
 * @param {string} options.code - The code to evaluate.
 * @param {Record<string, any>} [options.data] - The data to transfer to the evaluation context.
 * @returns {EvaluateResult} The result of the evaluation. Can't be a function or contain functions.
 */
export function evaluateSync(options: Expand<EvaluateOptions>): EvaluateResult {
  // Only lib type supports sync
  return lib.evaluateSync(options);
}

/**
 * Evaluates processors using either library module or REST API module. The module type is determined automatically.
 *
 * @param {object} [options.form] - The form to evaluate.
 * @param {object} [options.submission] - The submission to evaluate.
 * @param {object} [options.scope] - The scope to evaluate.
 * @param {string} [options.token] - The token to pass to evaluations.
 * @returns {Promise<EvaluateProcessorsResult>} An object containing result scope and data. Can't contain functions.
 */
export function evaluateProcess(options: Expand<EvaluateProcessorsOptions>): Promise<EvaluateProcessorsResult> {
  if (getModuleType() === ModuleType.Server) {
    return requests.evaluateProcess(options);
  }
  else if (getModuleType() === ModuleType.Lib) {
    return lib.evaluateProcess(options);
  }
  throw new Error('Unknown module type');
}


export function renderEmail(options: any) {
  return lib.renderEmail(options);
}