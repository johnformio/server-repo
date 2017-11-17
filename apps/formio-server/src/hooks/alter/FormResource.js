'use strict';

module.exports = app => Resource => {
  return (app, route, modelName, model) => {
    const parent = Resource(app, route, modelName, model);

    const FormResource = Object.create(parent);

    /**
     * The index verions for a resource.
     *
     * @param options
     */
    //FormResource.indexVersion = function(options) {
    //  options = this.getMethodOptions('index', options);
    //  this.methods.push('index');
    //  this.register(app, 'get', this.route + '/:' + this.name + 'Id/v', function(req, res, next) {
    //    // Store the internal method for response manipulation.
    //    req.__rMethod = 'index';
    //
    //    // Allow before handlers the ability to disable resource CRUD.
    //    if (req.skipResource) {
    //      return next();
    //    }
    //
    //    // Get the find query.
    //    var findQuery = this.getFindQuery(req);
    //
    //    // TODO: Fix the queries.
    //    // Get the query object.
    //    //var countQuery = req.countQuery || req.modelQuery;
    //    //var query = req.modelQuery;
    //    var countQuery = app.formio.mongoose.models.formrevision;
    //    var query = app.formio.mongoose.models.formrevision;
    //
    //    findQuery['_rid'] = req.params[this.name + 'Id'];
    //
    //    // First get the total count.
    //    countQuery.find(findQuery).count(function(err, count) {
    //      if (err) {
    //        return this.setResponse.call(this, res, {status: 500, error: err}, next);
    //      }
    //
    //      // Get the default limit.
    //      var defaults = {limit: 10, skip: 0};
    //      var reqQuery = _.mapValues(_.defaults(_.pick(req.query, 'limit', 'skip'), defaults), function(value, key) {
    //        value = parseInt(value, 10);
    //        return (isNaN(value) || (value < 0)) ? defaults[key] : value;
    //      });
    //
    //      // If a skip is provided, then set the range headers.
    //      if (reqQuery.skip && !req.headers.range) {
    //        req.headers['range-unit'] = 'items';
    //        req.headers.range = reqQuery.skip + '-' + (reqQuery.skip + (reqQuery.limit - 1));
    //      }
    //
    //      // Get the page range.
    //      var pageRange = paginate(req, res, count, reqQuery.limit) || {
    //          limit: reqQuery.limit,
    //          skip: reqQuery.skip
    //        };
    //
    //      // Make sure that if there is a range provided in the headers, it takes precedence.
    //      if (req.headers.range) {
    //        reqQuery.limit = pageRange.limit;
    //        reqQuery.skip = pageRange.skip;
    //      }
    //
    //      // Next get the items within the index.
    //      var queryExec = query
    //        .find(findQuery)
    //        .limit(reqQuery.limit)
    //        .skip(reqQuery.skip)
    //        .select(this.getParamQuery(req, 'select'))
    //        .sort(this.getParamQuery(req, 'sort'));
    //
    //      // Only call populate if they provide a populate query.
    //      var populate = this.getParamQuery(req, 'populate');
    //      if (populate) {
    //        queryExec = queryExec.populate(populate);
    //      }
    //
    //      options.hooks.index.before.call(
    //        this,
    //        req,
    //        res,
    //        findQuery,
    //        queryExec.exec.bind(queryExec, function(err, items) {
    //          if (err) {
    //            if (err.name === 'CastError' && populate) {
    //              err.message = 'Cannot populate "' + populate + '" as it is not a reference in this resource';
    //            }
    //
    //            return this.setResponse.call(this, res, {status: 500, error: err}, next);
    //          }
    //
    //          options.hooks.index.after.call(
    //            this,
    //            req,
    //            res,
    //            items,
    //            this.setResponse.bind(this, res, {status: res.statusCode, item: items}, next)
    //          );
    //        }.bind(this))
    //      );
    //    }.bind(this));
    //  }, this.respond.bind(this), options);
    //  return this;
    //};

    /**
     * Register the GET version method for this resource.
     */
    //FormResource.getVersion = function(options) {
    //  options = this.getMethodOptions('get', options);
    //  this.methods.push('get');
    //  this.register(app, 'get', this.route + '/:' + this.name + 'Id/v/:' + this.name + 'Vid', function(req, res, next) {
    //    // Store the internal method for response manipulation.
    //    req.__rMethod = 'get';
    //
    //    if (req.skipResource) {
    //      return next();
    //    }
    //
    //    //var query = req.modelQuery || this.versionModel;
    //    var query = app.formio.mongoose.models.formrevision;
    //    var search = {
    //      '_rid': req.params[this.name + 'Id'],
    //      '_vid': !isNaN(req.params[this.name + 'Vid']) ?
    //        parseInt(req.params[this.name + 'Vid']) :
    //        req.params[this.name + 'Vid']
    //    };
    //
    //    options.hooks.get.before.call(
    //      this,
    //      req,
    //      res,
    //      search,
    //      query.findOne.bind(query, search, function(err, item) {
    //        if (err) {
    //          return this.setResponse.call(this, res, {status: 500, error: err}, next);
    //        }
    //        if (!item) {
    //          return this.setResponse.call(this, res, {status: 404}, next);
    //        }
    //
    //        return options.hooks.get.after.call(
    //          this,
    //          req,
    //          res,
    //          item,
    //          this.setResponse.bind(this, res, {status: 200, item: item}, next)
    //        );
    //      }.bind(this))
    //    );
    //  }, this.respond.bind(this), options);
    //  return this;
    //};

    //FormResource.rest = function(options) {
    //  parent.rest.call(this, options);
    //  return this
    //    .indexVersion(options)
    //    .getVersion(options);
    //};

    return FormResource;
  };
};
