type FormioConfig = {
    sslEnabled: boolean;
    port: number;
    sslKey?: string;
    sslCert?: string;
};

function parseBooleanEnvVar(value: string | undefined) {
    if (!value) return;
    if (value === 'true' || value === 'false') {
        return value === 'true';
    }
    if (value === '1' || value === '0') {
        return value === '1';
    }
    return;
}

function parseNumberEnvVar(value: string | undefined) {
    if (!value) return;
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
        return numValue;
    }
    return;
}

export function initConfig(): FormioConfig {
    return {
        port: parseNumberEnvVar(process.env.PORT) || 3005,
        sslEnabled: parseBooleanEnvVar(process.env.ENABLE_SSL) || false,
        sslKey: process.env.SSL_KEY,
        sslCert: process.env.SSL_CERT,
    };
}
