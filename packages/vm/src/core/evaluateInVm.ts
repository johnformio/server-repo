import * as vm from 'node:vm';
import { Context, RunningCodeInNewContextOptions } from 'node:vm';
import _ from 'lodash';
import debug from 'debug';
import moment from 'moment';

import { utils } from './Formio';

interface EvaluateInVmOptions extends RunningCodeInNewContextOptions {
    includeLibs: boolean;
}

const evaluatorLog = debug('vm:evaluator');

function isPotentiallyMalicious(str: string) {
    return /(constructor)|(Function)|(Proxy)/.test(str);
}

export function evaluateInVm<
    WritableType extends Context,
    ReadableType extends Context
>(
    code: string,
    writable: WritableType,
    readable: ReadableType,
    resultKey: keyof WritableType,
    options: EvaluateInVmOptions
) {
    const writableContext = writable;
    const readableContext = Object.freeze({
        ...readable,
        ...(options.includeLibs
            ? {
                  moment,
                  _,
                  jsonLogic: utils.jsonLogic,
                  util: utils,
                  utils,
              }
            : {}),
    });
    const context = { ...writableContext, ...readableContext };

    if (isPotentiallyMalicious(code)) {
        evaluatorLog('Found potentially malicious code:');
        evaluatorLog(code);
        evaluatorLog('Skipping evalutation.');
        return null;
    }

    vm.runInNewContext(code, context, options);
    return context[resultKey] as any;
}
