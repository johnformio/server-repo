'use strict';

var jwt = require('jsonwebtoken');
var Primus = require('primus');
var Redis = require('redis');
var Q = require('q');
var _ = require('lodash');
var chance = new require('chance')(); // eslint-disable-line new-cap
var debug = require('debug')('formio:error');

module.exports = function(formio) {
  var cache = require('../../cache/cache')(formio);
  var SparkCollection = require('./SparkCollection');

  /**
   * ProjectSocket
   *   A socket connection for projects.
   *
   * @param server
   * @param config
   * @constructor
   */
  var ProjectSocket = function(server, config) {
    this.config = config;
    this.server = server;
    this.requests = [];

    var redis = {
      url: config.redis.url
    };

    if (config.redis.password) {
      /* eslint-disable camelcase */
      redis.auth_pass = config.redis.password;
      /* eslint-enable camelcase */
    }

    // Get the redis server.
    var redisServer = null;
    try {
      redisServer = Redis.createClient(redis);
    }
    catch (err) {
      debug.error(err);
      redisServer = null;
    }

    // Create the place to store all of our sparks.
    this.sparks = new SparkCollection();
    this.sparks.connect(redisServer).then(function() {
      var primusConfig = {
        transformer: 'websockets'
      };

      if (redisServer) {
        primusConfig.redis = redisServer;
      }

      // Create the primus server.
      this.primus = new Primus(server, primusConfig);

      // Include the plugins.
      this.primus.use('omega-supreme', require('omega-supreme'));
      this.primus.use('metroplex', require('metroplex'));

      // Authorize each request.
      this.primus.authorize(this.authorize.bind(this));

      // Handle global primus data communication.
      this.primus.on('data', function(data) {
        if (data.type === 'response' && data.id) {
          this.handleResponse(data);
        }

        // End an existing spark.
        if (data.type === 'remove') {
          var currentSpark = this.primus.spark(data.connection.sparkId);
          if (currentSpark) {
            currentSpark.end();
            this.sparks.del(data.projectId);
          }
        }
      }.bind(this));

      // Trigger when a new connection is made.
      this.primus.on('connection', function(spark) {
        var projectId = spark.request.project._id.toString();

        // Get the sparkId from the project.
        this.sparks.get(projectId).then(function(connection) {
          // Close existing connections open for this project.
          if (connection) {
            connection = JSON.parse(connection);
            var currentSpark = this.primus.spark(connection.sparkId);
            if (currentSpark) {
              currentSpark.end();
              this.sparks.del(projectId);
            }
            else {
              this.forward(connection, {
                type: 'remove',
                connection: connection,
                projectId: projectId
              }, function(err) {
                if (err) {
                  this.sparks.del(projectId);
                }
              }.bind(this));
            }
          }

          // Remove the spark if it ends.
          spark.on('end', function() {
            this.sparks.del(projectId);
          }.bind(this));

          // Handle data from our socket.
          spark.on('data', function(data) {
            // Allow them to bind to certain messages within a project.
            if (data.type === 'bind') {
              // Load the existing sparks for this project.
              this.sparks.get(projectId).then(function(connection) {
                // Use the existing connection or create a new one.
                connection = connection ? JSON.parse(connection) : {
                  token: spark.request.apitoken,
                  sparkId: spark.id,
                  bindings: []
                };

                // Do not allow them to create more than 100 bindings within a connection.
                if (connection.bindings.length > 100) {
                  return;
                }

                // The binding definition.
                var binding = {
                  method: data.bind.method.toUpperCase(),
                  form: data.bind.form,
                  sync: data.bind.sync || false
                };

                // Look for an existing binding.
                var currentIndex = _.findIndex(connection.bindings, _.pick(binding, 'method', 'form'));
                if (currentIndex !== -1) {
                  connection.bindings[currentIndex] = binding;
                }
                else {
                  connection.bindings.push(binding);
                }

                // Store the connection back into redis.
                this.sparks.set(projectId, JSON.stringify(connection)).then(function() {
                  spark.write({
                    type: 'ack',
                    msg: data
                  });
                }).catch(function(err) {
                  spark.write({
                    type: 'ack',
                    error: err.toString()
                  });
                });
              }.bind(this));
            }

            // A request that was forwarded from another server.
            if (data.type === 'request') {
              // Handle this request.
              this.handle(data).then(function(response) {
                // Send the response back to the original server.
                this.primus.forward(data.address, response, null, function(url) {
                  url.query = {
                    primus: 1,
                    token: spark.request.apitoken,
                    projectId: data.request.params.projectId
                  };
                  return url;
                }, function() {});
              }.bind(this));
            }

            // A response that came from our socket.
            if (data.type === 'response' && data.id) {
              this.handleResponse(data);
              spark.write({
                type: 'ack',
                error: '',
                msg: data
              });
            }
          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this));
  };

  /**
   * Handle the response from a web socket.
   * @param data
   */
  ProjectSocket.prototype.handleResponse = function(data) {
    var index = _.findIndex(this.requests, {id: data.id});
    if (index !== -1) {
      var promise = this.requests[index].promise;
      this.requests.splice(index, 1);
      promise.resolve(data);
      return true;
    }
    return false;
  };

  /**
   * Load a project by either the ID or the Project name.
   *
   * @param req
   * @param id
   * @param name
   * @param fn
   */
  ProjectSocket.prototype.loadProject = function(req, id, name, fn) {
    if (id) {
      cache.loadProject(req, id, fn);
    }
    else {
      cache.loadProjectByName(req, name, fn);
    }
  };

  /**
   * Authorize the project socket.
   *
   * @param {Object} req
   *   The express request object.
   * @param {Function} authorized
   *   The callback function to invoke with the results of authorize.
   *
   * @returns {*}
   */
  ProjectSocket.prototype.authorize = function(req, authorized) {
    var token = req.query.token;
    var project = req.query.project;
    var projectId = req.query.projectId;
    if (!token) {
      return authorized(new Error('Missing access token'));
    }
    if (!project && !projectId) {
      return authorized(new Error('Missing project'));
    }

    // Load the project.
    this.loadProject(req, projectId, project, (err, project) => {
      if (err) {
        return authorized(new Error(err));
      }

      if (!project) {
        return authorized(new Error('Unknown project'));
      }

      // Check if this is an api token.
      if (project.settings && project.settings.keys && _.find(project.settings.keys, {key: token})) {
        req.project = project;
        req.apitoken = token;
        return authorized();
      }

      // Verify the token.
      jwt.verify(token, this.config.formio.jwt.secret, (err, decoded) => {
        if (err) {
          return authorized(new Error(err.name));
        }

        if (!decoded) {
          return authorized(new Error('Invalid Token'));
        }

        if (!decoded.user._id) {
          return authorized(new Error('Invalid User'));
        }

        // Save the user on the request.
        req.user = decoded.user;

        // Project owners always get access.
        if (project.owner && (decoded.user._id.toString() === project.owner.toString())) {
          req.project = project;
          req.apitoken = jwt.sign(decoded, this.config.formio.jwt.secret);
          return authorized();
        }

        // Find the user object.
        formio.resources.submission.model.findOne({
          _id: formio.util.idToBson(req.user._id)
        }, (err, user) => {
          if (err) {
            return authorized(new Error('Unauthorized'));
          }

          // Check if they have the admin role.
          var userRoles = _.map(user.roles, formio.util.idToString);
          formio.resources.role.model.find({
            deleted: {$eq: null},
            project: project._id.toString(),
            admin: true
          }, (err, roles) => {
            if (err) {
              return authorized(new Error('Unauthorized'));
            }

            var roleIds = _.map(roles, function(role) {
              return role._id.toString();
            });

            var access = _.filter(_.map(roleIds, function(roleId) {
              return (userRoles.indexOf(roleId) === -1) ? null : roleId;
            }));

            if (access && access.length) {
              req.project = project;
              req.apitoken = jwt.sign(decoded, this.config.formio.jwt.secret);
              return authorized();
            }

            // Check the teams they are on.
            formio.teams.getTeams(req.user._id, true, false).then((teams) => {
              teams = teams || [];
              teams = _.map(_.map(teams, '_id'), formio.util.idToString);
              var userTeams = [];
              _.each(project.access, (projectAccess) => {
                if (projectAccess.type === 'team_admin') {
                  var teamRoles = _.map(projectAccess.roles, formio.util.idToString);
                  userTeams = _.intersection(teamRoles, teams);
                  if (userTeams && userTeams.length) {
                    return false;
                  }
                }
              });
              if (userTeams && userTeams.length) {
                req.project = project;
                req.apitoken = jwt.sign(decoded, this.config.formio.jwt.secret);
                return authorized();
              }

              return authorized(new Error('Unauthorized'));
            });
          });
        });
      });
    });
  };

  /**
   * Forward a message onto another server.
   *
   * @param connection
   * @param msg
   * @param fn
   */
  ProjectSocket.prototype.forward = function(connection, msg, fn) {
    this.primus.metroplex.spark(connection.sparkId, function(err, server) {
      if (err) {
        return fn(err);
      }

      if (!server) {
        return fn('No server found');
      }

      // Need to add the token to authenticate on new server.
      msg.address = this.primus.metroplex.address;
      this.primus.forward(server, msg, connection.sparkId, function(url) {
        url.query = {
          primus: 1,
          token: connection.token,
          projectId: msg.request.params.projectId
        };
        return url;
      }, fn);
    }.bind(this));
  };

  /**
   * Handle a request to a websocket connection.
   *
   * @param request
   * @returns {*|promise}
   */
  ProjectSocket.prototype.handle = function(request) {
    // Allow for a deferred execution.
    var deferred = Q.defer();

    // Ensure we have everything we need for socket connection.
    if (
      !this.sparks.ready ||
      !request ||
      !request.request ||
      !request.request.params ||
      !request.request.params.projectId ||
      !request.request.params.formId
    ) {
      deferred.resolve();
      return deferred.promise;
    }

    // Get the connection for this project.
    this.sparks.get(request.request.params.projectId).then(function(connection) {
      if (!connection) {
        deferred.resolve();
        return;
      }

      connection = JSON.parse(connection);

      // Get the binding.
      var binding = _.find(connection.bindings, {
        method: request.request.method.toUpperCase(),
        form: request.request.params.formId
      });

      // If no binding if found, then immediately resolve the promise.
      if (!binding) {
        deferred.resolve();
        return;
      }

      // If this is supposed to be a synchronous bind.
      if (binding.sync) {
        // Only allow up to 1000 concurrent requests...
        if (this.requests.length > 1000) {
          var expired = this.requests.shift();
          expired.promise.resolve();
        }

        // Add this promise to the list of concurrent requests.
        this.requests.push({
          id: request.id,
          promise: deferred
        });

        // Timeout the promise after 10 seconds.
        setTimeout(function() {
          var index = _.findIndex(this.requests, {id: request.id});
          if (index !== -1) {
            this.requests.splice(index, 1);
          }
          deferred.resolve();
        }.bind(this), 10000);
      }

      // Get the web socket connection.
      var spark = this.primus.spark(connection.sparkId);
      if (!spark) {
        // If this spark does not exist, then forward it on...
        this.forward(connection, request, function(err, result) {
          if (err || !result) {
            deferred.resolve();
          }
        });
        return;
      }

      // Write to the client the request.
      spark.write(request);

      // Resolve immediately if the request is asynchronous.
      if (!binding.sync) {
        deferred.resolve();
      }
    }.bind(this)).catch(function() {
      deferred.resolve();
    });

    // Return a promise.
    return deferred.promise;
  };

  /**
   * Close the project socket.
   *
   * @param done
   */
  ProjectSocket.prototype.close = function(done) {
    if (this.primus) {
      this.primus.destroy(done);
    }
    else {
      done();
    }
  };

  /**
   * Create a new request to send.
   *
   * @param data
   * @returns {{type: string, id: *, request: *}}
   */
  ProjectSocket.prototype.newRequest = function(data) {
    return {
      type: 'request',
      id: chance.string({
        pool: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        length: 12
      }),
      request: data
    };
  };

  /**
   * Send a request through a websocket.
   *
   * @param request
   * @returns {*|promise}
   */
  ProjectSocket.prototype.send = function(request) {
    return this.handle(this.newRequest(request));
  };

  return ProjectSocket;
};
