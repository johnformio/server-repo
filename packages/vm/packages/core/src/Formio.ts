'use strict';
// eslint-disable-next-line n/no-deprecated-api
import Domain from 'node:domain';
import _ from 'lodash';
import debug from 'debug';

import { evaluateInVm } from './evaluateInVm';
import { evaluateError } from './util.js';

type EvaluatorArgs = {
    instance?: any;
    self?: any;
    root?: any;
    options?: any;
};

const evaluatorLog = debug('vm:evaluator');

// Establish Domain
const domain = Domain.create();
domain.on('error', (err: Error) => {
    console.error('Asynchronous error while executing script.', err.stack);
});

// Define a few global noop placeholder shims and import the component classes
(globalThis as any).navigator = { userAgent: '' };
Object.defineProperty(globalThis, 'navigator', { userAgent: '' } as any);
(globalThis.Text as any) = class {};
(globalThis.HTMLElement as any) = class {};
(globalThis.HTMLCanvasElement as any) = class {};
(globalThis.document as any) = {
    createElement: () => ({}),
    cookie: '',
    getElementsByTagName: () => [],
    documentElement: {
        style: [],
        firstElementChild: { appendChild: () => {} },
    },
};
(globalThis.window as any) = {
    addEventListener: () => {},
    Event: function () {},
    navigator: globalThis.navigator,
};
(globalThis.btoa as any) = (str: string | Buffer) => {
    return str instanceof Buffer
        ? str.toString('base64')
        : Buffer.from(str.toString(), 'binary').toString('base64');
};
(globalThis.self as any) = globalThis;

const Formio = require('formiojs/formio.form.js').Formio;
const utils = Formio.Utils;

(globalThis as any).Formio = Formio.Formio;

const zones = require('moment-timezone/data/packed/latest.json');
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
        // TODO
        // Apply InstanceProxy and FromProxy to sanitize object before passing them to sandbox
        // if (args.instance) {
        //     args.instance = new InstanceProxy(args.instance);
        // }
        // if (args.self) {
        //     args.self = new InstanceProxy(args.self);
        // }
        // if (args.root) {
        //     args.root = new FormProxy(args.root);
        // }
        // Remove `options` object as it has vulnerable data
        // And not actually widely used
        // if (args.options) {
        //     args.options = {};
        // }
        try {
            const code = `result = (function({${_.keys(args).join(
                ','
            )}}) {${func}})(args);`;
            result = evaluateInVm(code, { result: null }, { args }, 'result', {
                timeout: 250,
                microtaskMode: 'afterEvaluate',
            });
        } catch (err: unknown) {
            // TODO: if your validation is suspect, should this return a validation error?
            const message = evaluateError(err);
            evaluatorLog(message);
        }
        return result;
    };
};

export { Formio, utils };
