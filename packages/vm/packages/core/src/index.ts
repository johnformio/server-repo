import express, { Request, Response } from 'express';
import debug from 'debug';
import methodOverride from 'method-override';
import dotenv from 'dotenv';

import WorkerThread from './Thread';
import { Form, Submission } from './types';
import { Validator } from './Validator';
import { evaluateInVm } from './evaluateInVm';
import { evaluateError } from './util';

interface JSON {
    [key: string]: string | boolean | number | JSON | JSON[];
}

interface ValidateRequest extends Request {
    body: {
        form: Form;
        submission: Submission;
    };
}

interface HasCodeAndResultProperty {
    code: string;
    resultVar: string;
}

type EvaluateRequestBody = HasCodeAndResultProperty & JSON;

interface EvaluateRequest extends Request {
    body: EvaluateRequestBody;
}

function isValidateRequest(value: Request): asserts value is ValidateRequest {
    if (!value.body) {
        throw new Error('POST request to /validate is missing a body');
    }
    if (!value.body.form || !value.body.submission) {
        throw new Error(
            'POST request to /validate is missing form or submission'
        );
    }
}

function isEvaluateRequest(value: Request): asserts value is EvaluateRequest {
    if (!value.body) {
        throw new Error('POST request to /evaluate is missing a body');
    }
    if (!value.body.code) {
        throw new Error('POST request to /evaluate is missing code snippet');
    }
}

function isValidHeader(
    value: string | string[] | undefined
): asserts value is string | undefined {
    if (Array.isArray(value)) {
        throw new Error(
            'POST request to /validate has malformed x-jwt-token header'
        );
    }
}

dotenv.config();
const log = debug('vm');
const app = express();
const port = 3001;
app.use(express.json({ limit: '16mb' }));

app.post('/evaluate', async (req, res) => {
    try {
        isEvaluateRequest(req);
        const { code, resultVar, libs, ...payload } = req.body;
        const result = evaluateInVm(
            code,
            { [resultVar]: null },
            payload,
            resultVar,
            {
                timeout: 250,
                microtaskMode: 'afterEvaluate',
            }
        );
        res.status(200).send(result);
    } catch (err: unknown) {
        log('Error in the /evaluate route:');
        res.status(400).send(evaluateError(err));
    }
});

app.post('/validate', async (req, res) => {
    try {
        const token = req.headers['x-jwt-token'];

        isValidateRequest(req);
        isValidHeader(token);

        const { form, submission } = req.body;
        const validator = new Validator(form, token, '');
        const { error, data, visibleComponents } = await validator.validate(
            submission
        );

        if (req.query.noValidate) {
            return res.status(200).json({ data, visibleComponents });
        }
        if (error) {
            return res.status(200).json({ error });
        }

        return res.status(200).json({ data, visibleComponents });
    } catch (err: unknown) {
        const message = evaluateError(err);
        log('Error in the validate route:');
        log(message);
        res.status(400).send(message);
    }
});

app.use(methodOverride('X-HTTP-Method-Override'));

app.post(
    '/worker/:worker',
    (req, res, next) => {
        if (!req.query.key || req.query.key !== process.env.KEY) {
            return res.status(401).send('Unauthorized');
        }
        return next();
    },
    (req, res) => {
        if (!req.params.worker) {
            return res.status(400).send('Unknown worker');
        }

        try {
            new WorkerThread(req.params.worker)
                .start(req.body)
                .then((response: any) => {
                    res.json(response);
                })
                .catch((err: unknown) => {
                    res.status(400).send(evaluateError(err));
                });
        } catch (err: unknown) {
            res.status(500).send(evaluateError(err));
        }
    }
);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
