'use strict';

/* eslint camelcase: 0 */
const crypto = require('crypto');
const _ = require('lodash');
const util = require('formio/src/util/util');

module.exports = function(config, formio) {
  return function(req, res, next) {
    if (!req.user || !req.userProject.primary) {
      return res.status(401);
    }

    if (!req.body || !req.body.data) {
      return res.status(400).send('No data received');
    }
    const list = ['ccNumber', 'ccExpiryMonth', 'ccExpiryYear', 'cardholderName', 'securityCode'];
    const missingFields = _.filter(list, function(prop) {
      return !req.body.data[prop];
    });
    if (missingFields.length !== 0) {
      return res.status(400).send(`JSON request is missing ${missingFields.join(', ')} properties`);
    }

    const userId = req.user._id.toString();

    // Send an authorize transaction.
    const sendAuthTxn = function(next) {
      const transactionRequest = {
        gateway_id: config.payeezy.gatewayId,
        password: config.payeezy.gatewayPassword,
        transaction_type: '01', // Pre-Authorization
        amount: 0,
        cardholder_name: req.body.data.cardholderName,
        cc_number: `${req.body.data.ccNumber}`,
        cc_expiry: req.body.data.ccExpiryMonth + req.body.data.ccExpiryYear,
        cc_verification_str2: req.body.data.securityCode,
        // Wont fit 20 char limit unless converted to base64
        customer_ref: new Buffer(userId, 'hex').toString('base64'),
        reference_3: userId, // Handy to keep a non base64 version, but this field isn't searchable
        user_name: userId,
        client_email: req.user.data.email,
        currency_code: 'USD'
      };
      const transactionBody = JSON.stringify(transactionRequest);
      const timestamp = (new Date()).toISOString();
      const content_digest = crypto.createHash('sha1').update(transactionBody, 'utf8').digest('hex');
      const hmac = crypto.createHmac('sha1', config.payeezy.hmacKey || '')
        .update(`POST\napplication/json\n${content_digest}\n${timestamp}\n${config.payeezy.endpoint}`, 'utf8')
        .digest('base64');

      return util.request({
        method: 'POST',
        url: `https://${config.payeezy.host}${config.payeezy.endpoint}`,
        body: transactionRequest,
        json: true,
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'x-gge4-content-sha1': content_digest,
          'x-gge4-date': timestamp,
          'Authorization': `GGE4_API ${config.payeezy.keyId}:${hmac}`
        }
      }).spread((response, body) => next(body));
    };

    formio.payment.getPaymentFormId(req.userProject._id)
    .then(function(formId) {
      const txnObject = {
        project: req.userProject._id,
        form: formId,
        owner: util.ObjectId(userId)
      };
      const txnQuery = _.clone(txnObject);
      txnQuery.deleted = {$eq: null};

      // Get any previous auth attempts.
      formio.resources.submission.model.findOne(txnQuery, (err, txn) => {
        if (err) {
          return next(err);
        }

        if (!txn) {
          txn = txnObject;
        }

        txn.metadata = txn.metadata || {};
        _.defaults(txn.metadata, {
          firstRequest: new Date(),
          requestCount: 0
        });

        // Add protection against multiple requests. Do not allow more than 5 per hour / user.
        if (txn.metadata.lastRequest && (txn.metadata.requestCount > 4)) {
          if (((txn.metadata.lastRequest - txn.metadata.firstRequest) / 36e5) > 1) {
            txn.metadata.firstRequest = new Date();
            txn.metadata.requestCount = 0;
          }
          else {
            return res.status(400).send('Too many requests. Please try again later.');
          }
        }

        // Set the last request and increment the request count.
        txn.metadata.lastRequest = new Date();
        txn.metadata.requestCount++;
        sendAuthTxn((body) => {
          if (!body.transaction_approved) {
            res.status(400);
            if (body.error_description) {
              return res.send(body.error_description);
            }
            if (body.exact_resp_code && body.exact_resp_code !== '00') {
              return res.send(body.exact_message);
            }
            if (body.bank_message) {
              return res.send(body.bank_message);
            }
            if (typeof body === 'string') {
              return res.send(body);
            }
            return res.send('Transaction Failed.');
          }

          txn.data = {
            cardholderName: body.cardholder_name,
            // Replace all but last 4 digits with *'s
            ccNumber: body.transarmor_token.replace(/\d(?=.*\d{4}$)/g, '*'),
            ccExpiryMonth: body.cc_expiry.substr(0, 2),
            ccExpiryYear: body.cc_expiry.substr(2, 2),
            transarmorToken: body.transarmor_token,
            cardType: body.credit_card_type,
            transactionTag: body.transaction_tag
          };

          // Update the transaction record.
          formio.resources.submission.model.findOneAndUpdate(txnQuery, txn, {
            new: true,
            upsert: true
          }).then(function() {
            return res.sendStatus(200);
          });
        });
      });
    })
    .catch(function(err) {
      next(err);
    });
  };
};
