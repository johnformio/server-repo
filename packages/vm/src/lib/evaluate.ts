import { evaluateInVm } from '../core/evaluateInVm';

type EvaluateArgs = {
    [key: string]: JSON | string | boolean;
    code: string;
    resultVar: string;
    libs: boolean;
};

export function evaluate({
    code,
    resultVar,
    libs = false,
    ...payload
}: EvaluateArgs) {
    const result = evaluateInVm(
        code,
        { [resultVar]: null },
        payload,
        resultVar,
        {
            timeout: 250,
            microtaskMode: 'afterEvaluate',
            includeLibs: libs,
        }
    );
    return result;
}
