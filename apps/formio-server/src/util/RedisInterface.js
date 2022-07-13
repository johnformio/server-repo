'use strict';

const _ = require('lodash');
const redis = require('redis');
const router = require('express').Router();
const BSON = new RegExp('^[0-9a-fA-F]{24}$');

class RedisInterface {
    constructor(config) {
        this.db = null;
        this.service = require('./service')(config);
        this.config = config;
        this.connect();
    }

    getDb(cb) {
        if (this.db) {
            return cb(null, this.db);
        }
        else {
            return cb(new Error('Redis not found.'), null);
        }
    }

    middleware(req, res, next) {
        this.getDb((err, db) => {
            if (err) {
                return res.status(500).send(err.message);
            }
            req.redis = res.redis = db;
            next();
        });
    }

    get router() {
        router.post('/get', (req, res) => {
            this.get(req.body.key, (err, result) => {
                if (err) {
                    return res.status(400).send(err.message);
                }
                return res.send(result);
            });
        });
        router.post('/set', (req, res) => {
            this.set(req.body.key, req.body.value, (err) => {
                if (err) {
                    return res.status(400).send(err.message);
                }
                return res.send('OK');
            });
        });
        router.post('/setexp', (req, res) => {
            this.setExp(req.body.key, req.body.value, req.body.expire, (err) => {
                if (err) {
                    return res.status(400).send(err.message);
                }
                return res.send('OK');
            });
        });
        router.post('/record', (req, res) => {
            this.record(
                req.body.project,
                req.body.path,
                req.body.method,
                req.body.type,
                req.body.start,
                (err) => {
                    if (err) {
                        return res.status(400).send(err.message);
                    }
                    return res.send('OK');
                }
            );
        });
        router.post('/project/year', (req, res) => {
            this.projectYear(
                req.body.project,
                req.body.year,
                (err, output) => {
                    if (err) {
                        return res.status(400).send(err.message);
                    }

                    return res.json(output);
                }
            );
        });
        router.post('/project/month', (req, res) => {
            this.projectMonth(
                req.body.project,
                req.body.year,
                req.body.month,
                (err, output) => {
                    if (err) {
                        return res.status(400).send(err.message);
                    }

                    return res.json(output);
                }
            );
        });
        router.post('/project/day', (req, res) => {
            this.projectDay(
                req.body.project,
                req.body.year,
                req.body.month,
                req.body.day,
                (err, output) => {
                    if (err) {
                        return res.status(400).send(err.message);
                    }

                    return res.json(output);
                }
            );
        });
        router.post('/calls', (req, res) => {
            this.calls(req.body.year, req.body.month, req.body.day, req.body.project, (err, calls) => {
                if (err) {
                    return res.status(400).send(err.message);
                }

                return res.json(calls);
            });
        });
        router.post('/analytics', (req, res) => {
            this.analytics(
                req.body.project,
                req.body.year,
                req.body.month,
                req.body.day,
                req.body.type,
                (err, analytics) => {
                    if (err) {
                        return res.status(400).send(err.message);
                    }
                    return res.json(analytics);
                }
            );
        });
        return router;
    }

    /**
     * Util function to build the analytics key with the given params.
     *
     * @param {String} project
     *   The project _id.
     * @param {String} year
     *   The year in utc time (YYYY).
     * @param {String} month
     *   The month in utc time (0-11).
     * @param {String} day
     *   The day in utc time (1-31).
     * @param {String} type
     *   The type of request (ns/s).
     *
     * @returns {String|Null}
     *   The redis key for the given params.
     */
    getAnalyticsKey(project, year, month, day, type) {
        if (!project || !year || (!month && month !== 0) || !day || !type) {
            return null;
        }

        return `${year.toString()}:${month.toString()}:${day.toString()}:${project.toString()}:${type.toString()}`;
    }

    /**
     * Get the formio analytics using the given glob and a redis transaction, and dump to json.
     *
     * @param {String} glob
     *   The glob pattern to match.
     * @param {Object} res
     *   The Express response object.
     */
    analytics(project, year, month, day, type, next) {
        if (this.service.active) {
            this.service.call('POST', '/analytics', {project, year, month, day, type}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }

            // Start the transaction and all the keys in question.
            const transaction = db.multi();
            this.keys(project, year, month, day, type, (err, keys) => {
                if (err) {
                    return next(err);
                }

                // Confirm the keys are unique and add them to the transaction.
                const wrapped = _(keys)
                    .uniq()
                    .value();

                wrapped.forEach((key) => {
                    transaction.llen(key);
                });

                transaction.exec((err, response) => {
                    if (err) {
                        return next(err);
                    }

                    return next(null, _(response)
                        .zip(wrapped)
                        .value());
                });
            });
        });
    }

    /**
     * Track project analytics in Redis.
     *
     * @param redis {Redis}
     *   The Redis connection.
     * @param project {String}
     *   The Project Id of this request.
     * @param path {String}
     *   The requested url for this request.
     * @param method {String}
     *   The http method used for this request.
     * @param start {Number}
     *   The date timestamp this request started.
     */
    record(project, path, method, type, start, next) {
        if (this.service.active) {
            this.service.call('POST', '/record', {project, path, method, type, start}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            // Don't count OPTIONS requests as they are just a preliminary request.
            if (method === 'OPTIONS') {
                return next ? next() : null;
            }

            if (!project) {
                return next ? next('Project not found') : null;
            }
            if (!method) {
                return next ? next('No method provided.') : null;
            }
            if (!path) {
                return next ? next('No path provided.') : null;
            }
            if (!_.isString(project) || !BSON.test(project)) {
                return next ? next('Invalid project.') : null;
            }

            // Update the redis key, dependent on if this is a submission or non-submission request.
            const now = new Date();
            const key = this.getAnalyticsKey(project, now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), type);
            const delta = start
                ? now.getTime() - start
                : 0;
            method = method.toString().toUpperCase();
            const value = `${path}:${method}:${now.getTime()}:${delta}`;

            // Add this record, to the end of the list at the position of the key.
            db.rpush(key, value, (err, length) => {
                if (err) {
                    return next ? next(err.message) : null;
                }

                return next ? next() : null;
            });
        });
    }

    calls(year, month, day, project, type, next) {
        if (this.service.active) {
            this.service.call('POST', '/calls', {year, month, day, project}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db || !year || (!month && month !== 0) || !project) {
                return next();
            }

            const transaction = db.multi();

            if (!day) {
                for (day = 1; day < 32; day++) {
                    transaction.llen(this.getAnalyticsKey(project, year, month, day, type));
                }
            }
            else {
                transaction.llen(this.getAnalyticsKey(project, year, month, day, type));
            }

            transaction.exec((err, response) => {
                if (err) {
                    return next();
                }

                const daysInMonth = (new Date(parseInt(year), parseInt(month) + 1, 0)).getUTCDate();
                response = _.sum(response.slice(0, daysInMonth));
                return next(null, response);
            });
        });
    }

    keys(project, year, month, day, type, next) {
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }

            let keys = [];

            // Recursively get all the keys matching the glob.
            let started = false;
            const glob = this.getAnalyticsKey(project, year, month, day, type);
            (function scan(cursor, cb) {
                if (cursor === '0' && started) {
                    return cb();
                }

                if (!started) {
                    started = true;
                }

                db.scan(cursor, 'MATCH', glob, (err, _keys) => {
                    if (err || !_keys) {
                        return cb(err);
                    }

                    if (_keys[1] && _keys[1].length > 0) {
                        keys = keys.concat(_keys[1]);
                    }

                    return scan(_keys[0], cb);
                });
            })('0', (err) => {
                if (err) {
                    return next ? next(err) : null;
                }

                return next ? next(null, keys) : null;
            });
        });
    }

    get(key, next) {
        if (this.service.active) {
            this.service.call('POST', '/get', {key}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            db.get(key, (err, result) => {
                if (err) {
                    return next ? next(err) : null;
                }
                return next ? next(null, result) : null;
            });
        });
    }

    setExp(key, value, expire, next) {
        if (this.service.active) {
            this.service.call('POST', '/setexp', {key, value, expire}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            db.set(key, value, 'EX', expire, (err) => {
                if (err) {
                    return next ? next(err) : null;
                }
                return next ? next() : null;
            });
        });
    }

    set(key, value, next) {
        if (this.service.active) {
            this.service.call('POST', '/set', {key, value}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            db.set(key, value, (err) => {
                if (err) {
                    return next ? next(err) : null;
                }
                return next ? next() : null;
            });
        });
    }

    projectYear(project, year, next) {
        if (this.service.active) {
            this.service.call('POST', '/project/year', {project, year}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            const transaction = db.multi();
            for (let month = 0; month < 12; month++) {
                for (let day = 1; day < 32; day++) {
                    transaction.llen(this.getAnalyticsKey(project, year, month, day, 's'));
                }
            }

            transaction.exec((err, response) => {
                if (err) {
                    return next ? next(err) : null;
                }

                const output = [];
                for (let month = 0; month < 12; month++) {
                    const monthData = response.slice((month * 31), ((month + 1) * 31));
                    const daysInMonth = (new Date(parseInt(year), parseInt(month) + 1, 0)).getUTCDate();
                    output.push({
                        month: month,
                        days: daysInMonth,
                        submissions: _.sum(monthData)
                    });
                }

                return next ? next(err, output) : null;
            });
        });
    }

    projectMonth(project, year, month, next) {
        if (this.service.active) {
            this.service.call('POST', '/project/month', {project, year, month}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            const transaction = db.multi();
            for (let day = 1; day < 32; day++) {
                transaction.llen(this.getAnalyticsKey(project, year, month, day, 's'));
            }

            transaction.exec((err, response) => {
                if (err) {
                    return next ? next(err) : null;
                }

                const daysInMonth = (new Date(parseInt(year), parseInt(month) + 1, 0)).getUTCDate();
                response = response.slice(0, daysInMonth);

                const output = [];
                for (let day = 0; day < response.length; day++) {
                    output.push({
                        day: day,
                        submissions: response[day]
                    });
                }

                return next ? next(err, output) : null;
            });
        });
    }

    projectDay(project, year, month, day, next) {
        if (this.service.active) {
            this.service.call('POST', '/project/day', {project, year, month, day}, next);
            return;
        }
        this.getDb((err, db) => {
            if (err || !db) {
                return next ? next() : null;
            }
            db.lrange(this.getAnalyticsKey(project, year, month, day, 's'), 0, -1, (err, response) => {
                if (err) {
                    return next ? next(err) : null;
                }
                return next ? next(err, {
                    submissions: _.map(response, (_request) => {
                        const parts = _request.split(':');
                        return parts[parts.length - 2];
                    })
                }) : null;
            });
        });
    }

    connect() {
        // If we have a service, then we just return here and do nothing.
        if (this.service.active) {
            return;
        }

        // Redis is not currently connected, attempt to configure the connection.
        console.log('Connecting to Redis');
        if (this.config.url) {
            const opts = {
                'retry_strategy': (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        // End reconnecting on a specific error and flush all commands with
                        // a individual error
                        this.db = null;
                        console.log(' > The server refused the connection (redis)');
                        return new Error('The server refused the connection');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        // End reconnecting after a specific timeout and flush all commands
                        // with a individual error
                        this.db = null;
                        console.log('Unable to restore connection to redis within 1 hour.');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 1000) {
                        // End reconnecting with built in error
                        this.db = null;
                        console.log('Unable to restore connection to redis within 1000 attempts.');
                        return undefined;
                    }
                    // reconnect after
                    const wait = Math.min(options.attempt * 100, 3000);
                    console.log(`Lost redis connection. Attempting to reconnect #${options.attempt} in ${wait}ms`, options.error);
                    return wait;
                }
            };
            if (this.config.password) {
                /* eslint-disable */
                opts.auth_pass = this.config.password;
                /* eslint-enable */
            }

            // Attempt to connect to redis.
            if (this.config.useSSL) {
                opts.tls = {servername: this.config.host};
                this.db = redis.createClient(this.config.port, this.config.host, opts);
            }
            else {
                this.db = redis.createClient(this.config.url, opts);
            }

            // Attach debugging to specific events, unset redis ref on error/disconnect.
            this.db.on('ready', () => {
                console.log(' > Redis connection successful');
            });
            this.db.on('error', (error) => {
                console.log(' > Redis connection error', error);
                this.db = null;
            });
            this.db.on('end', () => {
                console.log(' > Redis connection closed');
                this.db = null;
            });
        }
        else {
            console.log(' > Redis not configured');
            this.db = null;
        }
    }
}

module.exports = RedisInterface;
