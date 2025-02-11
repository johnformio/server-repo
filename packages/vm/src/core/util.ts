type ErrorLike = {
    message: string;
    stack?: string;
};

function isErrorLike(obj: any): obj is ErrorLike {
    return obj.message && typeof obj.message === 'string';
}

export function evaluateError(err: unknown) {
    if (err instanceof Error || isErrorLike(err)) {
        return `${err.message}\n${err.stack || ''}`;
    } else if (typeof err === 'string') {
        return err;
    } else {
        const stringified = JSON.stringify(err, null, 2);
        return stringified;
    }
}
