import {
    Worker,
    isMainThread,
    workerData,
    parentPort,
} from 'node:worker_threads';

const instantiateWorker = (task: string, data: any) => {
    if (isMainThread) {
        return new Promise((resolve, reject) => {
            try {
                const worker = new Worker(__filename, {
                    workerData: JSON.parse(
                        JSON.stringify({
                            task,
                            data,
                        })
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
            'instantiateWorker should not be called from a worker thread.'
        );
    }
};

if (!isMainThread) {
    import(workerData.task)
        .then((module) => {
            const { task } = module.default;
            return task(workerData.data);
        })
        .then((output: any) => {
            parentPort?.postMessage(
                typeof output === 'string'
                    ? output
                    : JSON.parse(JSON.stringify(output))
            );
        });
}

export default instantiateWorker;
