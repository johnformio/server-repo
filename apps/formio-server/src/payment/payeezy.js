'use strict';

/* eslint camelcase: 0 */
const crypto = require('crypto');
const _ = require('lodash');
const request = require('request');
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
        transaction_type: 'authorize', // Pre-Authorization
        currency_code: 'USD',
        method: "credit_card",
        amount: 0,
        credit_card: {
          type: req.body.data.ccType, // TODO: Add ccType (Credit Card Type Field) field in the Payment Form.
          cardholder_name: req.body.data.cardholderName,
          card_number: `${req.body.data.ccNumber}`,
          exp_date: req.body.data.ccExpiryMonth + req.body.data.ccExpiryYear,
          cvv: req.body.data.securityCode,
        },
        // Wont fit 20 char limit unless converted to base64
        customer_ref: new Buffer(userId, 'hex').toString('base64'),
        reference_3: userId, // Handy to keep a non base64 version, but this field isn't searchable
        user_name: userId,
        client_email: req.user.data.email,
      };
      const getAuthorizationHeader = function(apiKey, apiSecret, payload, token, nonce, timestamp) {
        var data = apiKey + nonce + timestamp + token + payload;
        var digest = crypto.createHmac('sha256', apiSecret).update(data).digest('hex');
        var header = new Buffer(digest.toString()).toString('base64');
        return header;
      };
      const nonce = Math.floor(Math.random() * 100000000000) + 1;
      const transactionBody = JSON.stringify(transactionRequest);
      const timestamp = (new Date()).getTime();
      return request.post({
        url: `https://${config.payeezy.host}${config.payeezy.endpoint}`,
        body: transactionBody,
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'apikey': config.payeezy.keyId,
          'token': config.payeezy.merchToken,
          'timestamp': timestamp,
          'nonce': nonce,
          'Authorization': getAuthorizationHeader(config.payeezy.keyId, config.payeezy.hmacKey, transactionBody, config.payeezy.merchToken, nonce, timestamp)
        }
      }, (err, response, body) => {
        if (err) {
         return next(err);
        }
        next(body);
      });
    };

    formio.payment.getPaymentFormId(req.userProject._id)
    .then(function(formId) {
      const txnObject = {
        project: req.userProject._id,
        form: util.ObjectId(formId),
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
          txn.data = {};
        }

        txn.metadata = txn.metadata || {};
        _.defaults(txn.metadata, {
          firstRequest: new Date(),
          requestCount: 0,
          failures: 0,
        });

        // Add protection against multiple requests. Do not allow more than 5 per day / user.
        if (txn.metadata.lastRequest && (txn.metadata.requestCount >= 5)) {
          if (((txn.metadata.lastRequest - txn.metadata.firstRequest) / 86400) > 1) {
            txn.metadata.firstRequest = new Date();
            txn.metadata.requestCount = 0;
          }
          else {
            return res.status(400).send('Too many requests. Please try again later.');
          }
        }

        if (txn.metadata.failures >= 5) {
          return res.status(400).send('Account disabled. Please contact support to enable.');
        }

        // Set the last request and increment the request count.
        txn.metadata.lastRequest = new Date();
        txn.metadata.requestCount++;

        sendAuthTxn((body) => {
          const transaction = JSON.parse(body);
          if (transaction.transaction_status !== 'approved') {
            // Update the transaction record.
            txn.metadata.failures++;
            formio.resources.submission.model.findOneAndUpdate(txnQuery, txn, {
              new: true,
              upsert: true
            });
            res.status(400);
            if (transaction.Error && transaction.Error.messages.length >= 0) {
              return res.send(`${transaction.transaction_status}: code: ${transaction.Error.messages[0].code} - ${transaction.Error.messages[0].description}`);
            }
            return res.send(`Transaction Failed: ${transaction.transaction_status}`);
          }

          if (!transaction.card) {
            res.status(400);
            return res.send('Card Information Missing in the transaction');
          }

          txn.data = {
            cardholderName: transaction.card.cardholder_name,
            // Replace all but last 4 digits with *'s
            ccNumber: transaction.token.token_data.value.replace(/\d(?=.*\d{4}$)/g, '*'),
            ccExpiryMonth: transaction.card.exp_date.substr(0, 2),
            ccExpiryYear: transaction.card.exp_date.substr(2, 2),
            token: transaction.token, // TODO: Add Token as hidden field in the Transactions Record Resource, contains token type and value.
            cardType: transaction.card.type,
            transactionTag: transaction.transaction_tag, // TODO: Add Text field in the Transactions Record Resource
            transactionId: transaction.transaction_id, // TODO: Add Text field in the Transactions Record Resource
            transactionStatus: transaction.transaction_status, // TODO: Add Text field in the Transactions Record Resource
            validationStatus: transaction.validation_status, // TODO: Add Text field in the Transactions Record Resource
            correlationId: transaction.correlation_id, // TODO: Add Text field in the Transactions Record Resource
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
