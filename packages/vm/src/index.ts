import { EvaluateOptions, EvaluateResult } from './core/evaluate';
import { EvaluateProcessorsOptions, EvaluateProcessorsResult } from './core/evaluateProcess';
import * as lib from './lib';
import * as server from './server/requests';

enum ModuleType {
  Server,
  Lib,
}
function getModuleType(): ModuleType {
  return ModuleType.Lib;
}

export function evaluate(options: EvaluateOptions): Promise<EvaluateResult> {
  if (getModuleType() === ModuleType.Server) {
    return server.evaluate(options);
  }
  else if (getModuleType() === ModuleType.Lib) {
    return lib.evaluate(options);
  }
  throw new Error('Unknown module type');
}

export function evaluateProcess(options: EvaluateProcessorsOptions): Promise<EvaluateProcessorsResult> {
  if (getModuleType() === ModuleType.Server) {
    return server.evaluateProcess(options);
  }
  else if (getModuleType() === ModuleType.Lib) {
    return lib.evaluateProcess(options);
  }
  throw new Error('Unknown module type');
}
