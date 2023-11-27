import { NextFunction, Request, Response } from 'express';

import { config } from './config.js';

function isStringHeader(
    key: string,
    value: string | string[]
): asserts value is string {
    if (Array.isArray(value)) {
        throw new Error(`Received malformed ${key} header`);
    }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
    const licenseKey = req.headers['x-license-key'];
    if (!licenseKey) {
        return res.status(401).send('x-license-key header is required');
    }
    isStringHeader('x-license-key', licenseKey);
    if (licenseKey !== config.licenseKey) {
        return res.status(401).send('License key authorization failed');
    }
    next();
}
