'use strict';

const _ = require('lodash');

module.exports = app => Resource => {
  return (app, route, modelName, model) => {
    const parent = Resource(app, route, modelName, model);

    const FormResource = Object.create(parent);

    /**
     * Register the GET version method for this resource.
     */
    FormResource.getDraft = function(options) {
      options = this.getMethodOptions('get', options);
      this.methods.push('get');
      this.register(app, 'get', this.route + '/:' + this.name + 'Id/draft', function(req, res, next) {
        // Store the internal method for response manipulation.
        req.__rMethod = 'get';

        if (req.skipResource) {
          return next();
        }

        app.formio.mongoose.models.formrevision.findOne({
          _rid: req.params.formId,
          _vid: 'draft'
        }, (err, item) => {
          if (err) {
            return this.setResponse.call(this, res, {status: 400, error: err}, next);
          }
          if (item) {
            return options.hooks.get.after.call(
              this,
              req,
              res,
              item,
              this.setResponse.bind(this, res, {status: 200, item: item}, next)
            );
          }
          // No draft was found. Return current form version instead.
          var query = req.modelQuery || this.model;
          var search = {'_id': req.params[this.name + 'Id']};

          options.hooks.get.before.call(
            this,
            req,
            res,
            search,
            query.findOne.bind(query, search, (err, item) => {
              if (err) {
                return this.setResponse.call(this, res, {status: 400, error: err}, next);
              }
              if (!item) {
                return this.setResponse.call(this, res, {status: 404}, next);
              }

              return options.hooks.get.after.call(
                this,
                req,
                res,
                item,
                this.setResponse.bind(this, res, {status: 200, item: item}, next)
              );
            })
          );
        });
      }, this.respond.bind(this), options);
      return this;
    };

    /**
     * Post (Create) a new item
     */
    FormResource.putDraft = function(options) {
      options = this.getMethodOptions('put', options);
      this.methods.push('put');
      this.register(app, 'put', this.route + '/:' + this.name + 'Id/draft', (req, res, next) => {
        // Store the internal method for response manipulation.
        req.__rMethod = 'put';

        if (req.skipResource) {
          return next();
        }

        // Remove __v field
        var update = _.omit(req.body, ['__v', '_id']);
        update._rid = req.params[this.name + 'Id'];
        update._vuser = req.user.data.name;
        update._vid = 'draft';

        app.formio.mongoose.models.formrevision.findOne({
          _rid: req.params[this.name + 'Id'],
          _vid: 'draft'
        }, (err, item) => {
          if (err) {
            return this.setResponse.call(this, res, {status: 400, error: err}, next);
          }
          if (!item) {
            return app.formio.mongoose.models.formrevision.create(update, (err, item) => {
              if (err) {
                return this.setResponse.call(this, res, {status: 400, error: err}, next);
              }

              // Trigger any after hooks before responding.
              return options.hooks.put.after.call(
                this,
                req,
                res,
                item,
                this.setResponse.bind(this, res, {status: 200, item: item}, next)
              );
            });
          }

          item.set(update);
          item.save((err, item) => {
            if (err) {
              return this.setResponse.call(this, res, {status: 400, error: err}, next);
            }

            return options.hooks.put.after.call(
              this,
              req,
              res,
              item,
              this.setResponse.bind(this, res, {status: 200, item: item}, next)
            );
          });
        });
      }, this.respond.bind(this), options);
      return this;
    };

    FormResource.rest = function(options) {
      parent.rest.call(this, options);
      return this
        .putDraft(options)
        .getDraft(options);
    };

    return FormResource;
  };
};
