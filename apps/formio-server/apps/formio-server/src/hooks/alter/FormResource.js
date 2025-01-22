'use strict';

const _ = require('lodash');

module.exports = app => Resource => {
  return (app, route, modelName, model) => {
    const parent = Resource(app, route, modelName, model);
    const ResourceClass = Resource.Resource;

    const FormResource = Object.create(parent);

    /**
     * Register the GET version method for this resource.
     */
    FormResource.getDraft = function(options) {
      options = ResourceClass.getMethodOptions('get', options);
      this.methods.push('get');
      this.register(app, 'get', `${this.route}/:${this.name}Id/draft`, async function(req, res, next) {
        // Store the internal method for response manipulation.
        req.__rMethod = 'get';

        if (req.skipResource) {
          return next();
        }

        try {
          const item = await app.formio.mongoose.models.formrevision.findOne({
          _rid: req.params.formId,
          _vid: 'draft'
          }).lean().exec();
          if (item) {
            return options.hooks.get.after.call(
              this,
              req,
              res,
              item,
              ResourceClass.setResponse.bind(ResourceClass, res, {status: 200, item: item}, next)
            );
          }
          // No draft was found. Return current form version instead.
          const query = req.modelQuery || req.model || this.model;
          const search = {'_id': req.params[`${this.name}Id`]};

          options.hooks.get.before.call(
            this,
            req,
            res,
            search,
            async () => {
              try {
                const item = await query.findOne(search).lean().exec();

                if (!item) {
                  return ResourceClass.setResponse(res, {status: 404}, next);
                }

                return options.hooks.get.after.call(
                  this,
                  req,
                  res,
                  item,
                  ResourceClass.setResponse.bind(ResourceClass, res, {status: 200, item: item}, next)
                );
              }
              catch (err) {
                return ResourceClass.setResponse(res, {status: 400, error: err}, next);
              }
            }
          );
        }
        catch (err) {
          return ResourceClass.setResponse(res, {status: 400, error: err}, next);
        }
      }, ResourceClass.respond.bind(ResourceClass), options);
      return this;
    };

    /**
     * Post (Create) a new item
     */
    FormResource.putDraft = function(options) {
      options = ResourceClass.getMethodOptions('put', options);
      this.methods.push('put');
      this.register(app, 'put', `${this.route}/:${this.name}Id/draft`, async (req, res, next) => {
        // Store the internal method for response manipulation.
        req.__rMethod = 'put';

        if (req.skipResource) {
          return next();
        }

        // Remove __v field
        const update = _.omit(req.body, ['__v', '_id']);
        update._rid = req.params[`${this.name}Id`];
        update._vuser = _.get(req, 'user.data.name') || _.get(req, 'user.data.email', req.user._id);
        update._vid = 'draft';

        try {
          let item = await app.formio.mongoose.models.formrevision.findOne({
            _rid: req.params[`${this.name}Id`],
            _vid: 'draft'
          }).exec();

          if (!item) {
            item = await app.formio.mongoose.models.formrevision.create(update);
              // Trigger any after hooks before responding.
              return options.hooks.put.after.call(
                this,
                req,
                res,
                item,
                ResourceClass.setResponse.bind(ResourceClass, res, {status: 200, item: item}, next)
              );
          }

          item = await app.formio.mongoose.models.formrevision.findOneAndUpdate({
            _id: item._id},
            {$set: update}
          );
          return options.hooks.put.after.call(
            this,
            req,
            res,
            item,
            ResourceClass.setResponse.bind(ResourceClass, res, {status: 200, item: item}, next)
          );
        }
        catch (err) {
          return ResourceClass.setResponse(res, {status: 400, error: err}, next);
        }
      }, ResourceClass.respond.bind(ResourceClass), options);
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
