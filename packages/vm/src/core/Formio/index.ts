import './instantiateGlobals.js';
import { Formio } from 'formiojs/formio.form.js';
import Domain from 'node:domain';
import _ from 'lodash';
import zones from 'moment-timezone/data/packed/latest.json';
import debug from 'debug';

import { evaluateInVm } from '../evaluateInVm.js';
import { evaluateError } from '../util.js';

type EvaluatorArgs = {
    instance?: any;
    self?: any;
    root?: any;
    options?: any;
};

const log = debug('Formio');

// Establish Domain
const domain = Domain.create();
domain.on('error', (err: Error) => {
    console.error('Asynchronous error while executing script.', err.stack);
});

const utils = Formio.Utils;

globalThis.Formio = Formio.Formio;

utils.moment.tz.load(zones);
utils.moment.zonesLoaded = true;

// Remove onChange events from all renderer displays.
_.each(Formio.Displays.displays, (display: any) => {
    display.prototype.onChange = _.noop;
});

utils.Evaluator.noeval = true;
utils.Evaluator.evaluator = function (func: string, args: EvaluatorArgs) {
    return function () {
        let result = null;
        // TODO: I don't think we still need {Form,Instance}Proxy do we?
        try {
            const code = `result = (function({${_.keys(args).join(
                ','
            )}}) {${func}})(args);`;
            result = evaluateInVm(code, { result: null }, { args }, 'result', {
                timeout: 250,
                microtaskMode: 'afterEvaluate',
                includeLibs: false,
            });
        } catch (err: unknown) {
            // TODO: if your validation is suspect, should this return a validation error?
            log(evaluateError(err));
        }
        return result;
    };
};

export { Formio, utils };
