import express, { Request } from 'express';
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';

import { evaluate, evaluateError, evaluateProcess } from '../core';
import { config } from './config';
import { authenticate } from './authenticate';

import { EvaluateOptions } from '../core/evaluate';

type EvaluateRequestBody = EvaluateOptions;
interface EvaluateRequest extends Request {
    body: EvaluateRequestBody;
}

function isEvaluateRequest(value: Request): asserts value is EvaluateRequest {
    if (!value.body) {
        throw new Error('POST request to /evaluate is missing a body');
    }
    if (!value.body.code) {
        throw new Error('POST request to /evaluate is missing code snippet');
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
        const result = await evaluate(req.body);
        return res.status(200).json(result);
    } catch (err: unknown) {
        res.status(400).send(evaluateError(err));
    }
});

app.post('/process', async (req, res) => {
    try {
        const result = await evaluateProcess(req.body.context);
        return res.status(200).json(result);
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
