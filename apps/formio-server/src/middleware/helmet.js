'use strict';
const helmet = require('helmet');
module.exports = (router) => {
    return [
        async function(req, res, next) {
            const helmetOverrides = {};
            if (
                (req.url === '/' && router.portalEnabled) ||
                req.url.endsWith('.html') ||
                req.url.endsWith('/manage') ||
                req.url.endsWith('/manage/') ||
                req.url.endsWith('/manage/view') ||
                req.url.endsWith('/manage/view/')
            ) {
                // Do not add opener, embedder, or resource policies.
                helmetOverrides.crossOriginOpenerPolicy = false;
                helmetOverrides.crossOriginEmbedderPolicy = false;
                helmetOverrides.crossOriginResourcePolicy = false;
                helmetOverrides.frameguard = false;

                // Strict-Transport-Security middleware
                helmetOverrides.hsts = {
                    includeSubDomains: true,
                    preload: true,
                    maxAge: 15552000
                };

                // Referer-Policy middleware
                helmetOverrides.referrerPolicy = {
                    policy: ['origin', 'same-origin'],
                };

                // Create the dynamic helmet middleware.
                const dynamicHelmet = (cspSettings) => {
                    helmetOverrides.contentSecurityPolicy = {
                        directives: cspSettings,
                    };
                    return helmet(helmetOverrides);
                };

                const hostParts = req.hostname.split('.');
                let host = '';
                if (hostParts[hostParts.length - 1].match(/^localhost(:[0-9]+)?$/)) {
                    host = '*';
                }
                else {
                    host = (hostParts.length > 1) ? hostParts.slice(-2).join('.') : req.hostname;
                }

                const defaultCSP = {
                    'upgrade-insecure-requests': null,
                    'default-src': ['*'],
                    'frame-src': ['*'],
                    'child-src': ['*', 'blob:', 'data:'],
                    'worker-src': ['*', 'blob:', 'data:'],
                    'img-src': ['*', 'blob:', 'data:'],
                    'media-src': ['*'],
                    'script-src': ['*', "'unsafe-inline'", "'unsafe-eval'"],
                    'style-src': ['*', "'unsafe-inline'"],
                    'font-src': ['*', 'blob:', 'data:'],
                    'connect-src': ['*']
                };

                if (!req.projectId ||
                    (req.projectId === 'available') ||
                    !router.formio.formio.mongoose.Types.ObjectId.isValid(req.projectId)
                ) {
                    return dynamicHelmet(defaultCSP)(req, res, next);
                }

                // Load the project settings.
                try {
                  let settings = await router.formio.formio.hook.settings(req);

                    // Build the CSP settings string.
                    settings = settings || {};
                    let cspSettings = settings.csp || '';
                    cspSettings = cspSettings.split(';');
                    cspSettings = cspSettings.reduce((acc, item) => {
                        const data = item.trim().split(/\s+/);
                        const [key] = data.splice(0, 1);
                        if (key) {
                            acc[key] = data;
                        }
                        return acc;
                    }, {...defaultCSP});

                    if (!cspSettings['default-src'].includes(host)) {
                        cspSettings['default-src'].push(host);
                    }

                    const portalDomain = settings.portalDomain || '';

                    if (portalDomain && cspSettings['default-src'].indexOf(portalDomain) === -1) {
                        cspSettings['default-src'].push(portalDomain);
                    }

                    return dynamicHelmet(cspSettings)(req, res, next);
                }
                catch (err) {
                  if (err === 'Project not found') {
                    return dynamicHelmet(defaultCSP)(req, res, next);
                  }
                  return next(err);
                }
            }
            else {
                return next();
            }
        },
        function(req, res, next) {
            // Explicitely set the origin agent cluster to false to allow subdomain iframe communication.
            res.setHeader('Origin-Agent-Cluster', '?0');
            next();
        }
    ];
};
