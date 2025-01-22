type HTTPFormioConfig = {
    sslEnabled: false;
    licenseKey: string;
};

type HTTPSFormioConfig = {
    sslEnabled: true;
    sslKey: string;
    sslCert: string;
};

type FormioVMConfig = {
    port: number;
    licenseKey: string;
} & (HTTPFormioConfig | HTTPSFormioConfig);

const DEFAULT_PORT = 3005;

function parseBooleanEnvVar(value: string | undefined) {
    if (value === 'true' || value === 'false') {
        return value === 'true';
    }
    if (value === '1' || value === '0') {
        return value === '1';
    }
    return false;
}

function parseNumberEnvVar(value: string | undefined) {
    if (!value) return;
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
        return numValue;
    }
    return;
}

function getConfig(): FormioVMConfig {
    const licenseKey = process.env.LICENSE_KEY;
    if (!licenseKey) {
        throw new Error('LICENSE_KEY environment variable was not provided.');
    }

    const port = parseNumberEnvVar(process.env.PORT) || DEFAULT_PORT;

    const sslEnabled = parseBooleanEnvVar(process.env.ENABLE_SSL);
    const sslKey = process.env.SSL_KEY;
    const sslCert = process.env.SSL_CERT;
    if (sslEnabled) {
        if (!sslKey) {
            throw new Error('TLS/SSL is enabled but no key was provided.');
        }
        if (!sslCert) {
            throw new Error(
                'TLS/SSL is enabled but no certificate was provided.'
            );
        }
        return { licenseKey, sslEnabled, sslKey, sslCert, port };
    }

    return { licenseKey, sslEnabled, port };
}

const config = getConfig();
export { config };
