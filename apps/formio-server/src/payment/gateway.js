'use strict';

const _ = require('lodash');
const fetch = require('formio/src/util/fetch');
const util = require('formio/src/util/util');

module.exports = function(config, formio) {
  return function(req, res, next) {
    if (!req.user || !req.userProject.primary) {
      return res.status(401);
    }

    if (!req.body) {
      return res.status(400).send('No data received');
    }

    const data = 'data' in req.body ? req.body.data : req.body;

    const list = ['ccNumber', 'ccExpiryMonth', 'ccExpiryYear', 'cardholderName', 'securityCode'];
    const missingFields = _.filter(list, function(prop) {
      return !data[prop];
    });
    if (missingFields.length !== 0) {
      return res.status(400).send(`JSON request is missing ${missingFields.join(', ')} properties`);
    }

    const userId = req.user._id.toString();
    const portalUser = req.user.data;
    if (process.env.TEST_SUITE) {
      portalUser.fullName = 'Formiotest Name';
    }

    const buildRequest = () => {
      if (process.env.TEST_SUITE) {
        return  {
            "save_account": true,
            "exp_date": "0924",
            "account_holder_name": "Test Account Name",
            "account_number": "5454545454545454",
            "transaction_amount": 1,
            "save_account_title": "Testing Account",
            "customer_id": "123123123",
            "cvv": "123",
            "description": `Formio Test Payment ${userId} ${portalUser.email}`
          };
      }

      return {
        "save_account": true,
        "exp_date": `${data.ccExpiryMonth}${data.ccExpiryYear}`,
        "account_holder_name": data.cardholderName,
        "account_number": data.ccNumber,
        "transaction_amount": 1,
        "save_account_title": portalUser.fullName,
        "customer_id": userId,
        "cvv": data.securityCode,
        "auto_decline_cvv_override": true,
        "description": `PaymentAuth: ${userId} ${portalUser.email}`
      };
    };

    // Send an authorize transaction.
    /* eslint-disable new-cap */
    const sendAuthTxn = async (next) => {
      const paymentApi = `${config.fortis.endpoint}`;
      const txn = await fetch(paymentApi, {
        headers: {
          "user-id": config.fortis.userId,
          "user-api-key": config.fortis.userAPIKey,
          "Content-Type": "application/json",
          "developer-id": config.fortis.developerId,
          "Accept": "application/json"
        },
        method: 'POST',
        body: JSON.stringify(buildRequest())
      }).then((response) => response.json());
      next(txn);
    };
    /* eslint-enable new-cap */

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
            // eslint-disable-next-line new-cap
            txn = new formio.resources.submission.model(txnObject);
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

          sendAuthTxn((transaction) => {
            if (process.env.TEST_SUITE && transaction && transaction.data) {
              txn.data = {
                cardholderName: transaction.data.cardholdername,
                // Replace all but last 4 digits with *'s
                ccNumber: transaction.data.last_four,
                ccExpiryMonth: data.ccExpiryMonth,
                ccExpiryYear: data.ccExpiryYear, // TODO: Change the value from 2 digits to 4 i.e 2023
                ccType: data.ccType,
                transactionTag: 'O1', // TODO: Add Text field in the Transactions Record Resource
                transactionStatus: transaction.data.status_code.toString(), // TODO: Add Text field in the Transactions Record Resource
                transactionId: transaction.data.id, // TODO: Add Text field in the Transactions Record Resource
              };
              txn.save();
              if (transaction.data.status_code === 102) {
                return res.sendStatus(200);
              }
              else {
                return res.status(400).send(`Transaction Failed: ${transaction.data.serviceErros}  ${transaction.data.verbiage}`);
              }
            }
            if (!transaction || !transaction.data) {
              if (transaction.meta && transaction.meta.errors) {
                let message = '';
                for (const error in transaction.meta.errors) {
                  message += `${error}: ${transaction.meta.errors[error][0]}`;
                }
                return res.status(400).send(`Transaction Failed: ${message}`);
              }
              return res.status(400).send(`Transaction Failed ${transaction}`);
            }
            if (transaction.data.status_code !== 102) {
              // Update the transaction record.
              txn.metadata.failures++;
              txn.markModified('metadata');
              txn.save();
              res.status(400);
              if (transaction.data.serviceErros) {
                return res.send(`Transaction Failed:  ${transaction.data.serviceErros}  ${transaction.data.verbiage}  ${transaction.data.status_code}`);
              }
              return res.send(`Transaction Failed: ${transaction.data.verbiage}  ${transaction.data.status_code}`);
            }

            if (!transaction.data.id) {
              txn.save();
              res.status(400);
              return res.send('Card Information Missing in the transaction');
            }

            txn.data = {
              cardholderName: transaction.data.account_holder_name,
              // Replace all but last 4 digits with *'s
              ccNumber: transaction.data.last_four,
              ccExpiryMonth: data.ccExpiryMonth,
              ccExpiryYear: data.ccExpiryYear,
              ccType: data.ccType,
              transactionTag: transaction.data.auth_code,
              transactionStatus: transaction.data.status_code === 102 ? 'approved' : 'declined',
              transactionId: transaction.data.id,
            };

            // Update the transaction record.
            txn.markModified('metadata');
            txn.markModified('data');
            txn.save();
            return res.sendStatus(200);
          });
        });
      })
      .catch(function(err) {
        next(err);
      });
  };
};
