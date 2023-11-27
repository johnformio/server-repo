import express, { Request } from 'express';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';

import { evaluateError } from '../core';
import { evaluate, validate, template } from '../lib';
import { config } from './config';
import { authenticate } from './authenticate';

import { Form, Submission } from '../types';

interface ValidateRequest extends Request {
    body: {
        form: Form;
        submission: Submission;
        decodedToken?: JSON;
    };
}

interface HasCodeAndResultProperty {
    code: string;
    resultVar: string;
    libs?: boolean;
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
    if (!value.body.resultVar) {
        throw new Error('POST request to /evaluate is missing result variable');
    }
}

function isStringHeader(
    value: string | string[] | undefined
): asserts value is string | undefined {
    if (Array.isArray(value)) {
        throw new Error(
            'POST request to /validate has malformed x-jwt-token header'
        );
    }
}

dotenv.config();
const app = express();

app.use(express.json({ limit: '32mb' }));
app.use(authenticate);

app.post('/evaluate', async (req, res) => {
    try {
        isEvaluateRequest(req);
        const {
            parse,
            stringify,
            code,
            resultVar,
            libs = false,
            ...payload
        } = req.body;
        const result = evaluate({
            code,
            libs,
            resultVar,
            ...payload,
        });
        res.status(200).send(result);
    } catch (err: unknown) {
        res.status(400).send(evaluateError(err));
    }
});

app.post('/validate', async (req, res) => {
    try {
        const token = req.headers['x-jwt-token'];

        isValidateRequest(req);
        isStringHeader(token);

        const { form, submission, decodedToken } = req.body;
        const validationResult = await validate(
            { form, submission },
            { token, decodedToken }
        );

        return res.status(200).json(validationResult);
    } catch (err: unknown) {
        res.status(400).send(evaluateError(err));
    }
});

app.post('/template', async (req, res) => {
    try {
        const payload = req.body;
        const result = await template(payload, false);
        res.status(200).json(result);
    } catch (err: unknown) {
        res.status(400).send(evaluateError(err));
    }
});

try {
    if (config.sslEnabled) {
        const { port, sslKey, sslCert } = config;
        const httpsOptions = {
            key: fs.readFileSync(sslKey),
            cert: fs.readFileSync(sslCert),
        };

        https.createServer(httpsOptions, app).listen(port, () => {
            console.log(`Formio VM listening on port ${port} over HTTPS...`);
        });
    } else {
        const { port } = config;
        app.listen(port, () =>
            console.log(`Form.io VM listening on port ${port}...`)
        );
    }
} catch (err: unknown) {
    const message = evaluateError(err);
    console.error(message);
    process.exit(1);
}
