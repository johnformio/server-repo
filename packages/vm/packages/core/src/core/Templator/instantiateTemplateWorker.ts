import {
    Worker,
    isMainThread,
    workerData,
    parentPort,
} from 'node:worker_threads';

import { template } from './template';
import { TemplateData, TemplateFn } from '../../types';

export const instantiateTemplateWorker = (data: TemplateData) => {
    if (isMainThread) {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker(__filename, {
                    workerData: JSON.parse(
                        JSON.stringify({ data, task: './template.js' })
                    ),
                });
                worker.on('message', (output) => {
                    worker.terminate();
                    return resolve(output);
                });
                worker.on('error', reject);
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(
                            new Error(`Worker stopped with exit code ${code}`)
                        );
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    } else {
        throw new Error(
            'instantiateTemplateWorker should not be called from a worker thread.'
        );
    }
};

if (!isMainThread) {
    import(workerData.task)
        .then((module) => {
            const { template }: { template: TemplateFn } = module.default;
            return template(workerData.data);
        })
        .then((output: any) => {
            parentPort?.postMessage(
                typeof output === 'string'
                    ? output
                    : JSON.parse(JSON.stringify(output))
            );
        });
}
