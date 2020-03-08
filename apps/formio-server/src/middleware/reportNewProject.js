'use strict';

const jwt = require('jsonwebtoken');
const request = require('request-promise-native');
const _ = require('lodash');

module.exports = formio => {
  const payload = jwt.decode(formio.config.license);

  return (req, res, next) => {
    // Allow license to specify no logging.
    if (!payload || payload.noLog) {
      return next();
    }

    // Continue processing and do this request in the background.
    /* eslint-disable callback-return */
    next();

    formio.mongoose.models.schema.findOne({
      key: 'dbIdentifier'
    }, (err, dbIdentifier) => {
      formio.mongoose.models.project.find().exec((err, items) => {
        const projects = _.map(items, item => ({
          _id: item._id.toString(),
          title: item.title,
          name: item.name,
          type: item.type,
          framework: item.framework,
          project: (item.project || '').toString(),
          plan: item.plan
        }));

        request({
          method: 'POST',
          url: 'https://formio.form.io/newProject',
          headers: {
            'content-type': 'application/json'
          },
          json: {
            data: {
              licenseId: payload._id,
              company: payload.company,
              dbIdentifier: dbIdentifier.value,
              projects,
              newProjectId: res.resource.item._id
            }
          }
        });
      });
    });
  };
};
