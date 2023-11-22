import express from 'express';
import dotenv from 'dotenv';
import methodOverride from 'method-override';
import WorkerThread from './Thread';
import { evaluateError } from './util.js';

dotenv.config();
const app = express();

const maxRequestBodySize = process.env.MAX_REQUEST_BODY_SIZE || '16mb';
app.use(
    express.json({
        limit: maxRequestBodySize,
    })
);
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

module.exports = app;
