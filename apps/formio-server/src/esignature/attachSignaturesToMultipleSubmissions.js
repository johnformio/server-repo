'use strict';
const _ = require('lodash');
const ESignature = require('./ESignature');
const debug = require('debug')('attachSignaturesToMultipleSubmissions:error');

module.exports = (formioServer, req, submissions, formId, done) => {
    submissions = submissions || [];
    if (_.isEmpty(submissions)) {
      return done(submissions);
    }

    formioServer.formio.cache.loadForm(req, null, formId, (err, form) => {
      if (err) {
        debug(`Unable to load reference form: ${err}`);
        return done(submissions, err);
      }

      const esignature = new ESignature(formioServer, req);

      if (esignature.allowESign(form)) {
        const esignPromises = _.map(submissions, subm => {
          let promiseRes;
          let promiseRej;

          const esignPromise = new Promise((res, rej) => {
            promiseRej = rej;
            promiseRes = res;
          });

          const esignature = new ESignature(formioServer, req);
          esignature.attachESignatures(subm, (err) => {
          if (err) {
            debug(`Unable to attach eSigantures: ${err}`);
            return promiseRej(err);
          }
          return promiseRes();
        });

        return esignPromise;
        });

        return Promise.all(esignPromises)
          .then(() => done(submissions))
          .catch(e => done(submissions, e));
      }
      else {
        return done(submissions);
      }
   });
};
