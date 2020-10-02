'use strict';

/* eslint camelcase: 0 */
const crypto = require('crypto');
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

    // Send an authorize transaction.
    /* eslint-disable new-cap */
    const sendAuthTxn = function(next) {
      const userNameParts = portalUser.fullName.split(' ');
      const paymentApi = config.tpro3.api;
      const customerRequest = {
        request:
          {
            authentication:
              {
                user:
                  {
                    gateway: config.tpro3.gateway,
                    emailaddress: config.tpro3.useremail,
                    password: config.tpro3.password,
                    application: 'Portal Formio',
                    version: '1.0'
                  }
              },
            content:{
              update:
                {
                  customer:
                    {
                      name: data.companyName ? data.companyName : `${portalUser.name}-${userId}`,
                      displayname: data.companyName ? data.companyName : portalUser.fullName,
                      '@refname': 'customer'
                    },
                },
              if: [
                {
                  create: {
                    customer: {
                      name: data.companyName ? data.companyName : `${portalUser.name}-${userId}`,
                      displayname: data.companyName ? data.companyName : portalUser.fullName,
                      '@refname': 'customer'
                    }
                  },
                  '@condition': `{!customer.responsestatus!} != 'success'`
                }
              ],
              '@continueonfailure': true
            }
          }
      };
      const buildRequest = (sessionId, content) => {
        return {
          request:
            {
              authentication:
                {
                  sessionId: sessionId
                },
              content: content
            }
        };
      };
      const uniqueNum = Math.floor(Math.random() * 1000) + 1;
      return fetch(paymentApi, {
        method: 'post',
        mode: 'cors',
        dataType: "json",
        body: JSON.stringify(customerRequest),
      })
        .then((response) => {
          if (process.env.TEST_SUITE) {
            return response.ok;
          }
          return response.ok ? response.text() : null;
        })
        .then((customerResponse) => {
          if (process.env.TEST_SUITE) {
            return next({
              cardholdernumber: `${data.ccNumber}`,
              cartype: data.ccType,
              cardholdername: data.cardholderName,
              expiresmonth: data.ccExpiryMonth,
              expiresyear: data.ccExpiryYear,
              cvv: data.securityCode,
              '@responsestatus': 'success'
            });
          }
          const customer = JSON.parse(decodeURIComponent(customerResponse));
          const customerId = customer.response.content.create ? customer.response.content.create.customer.id : customer.response.content.update.customer.id;
          const sessionId = customer.response.authentication.sessionid;
          const contactContent = {
            update:
              {
                contact:
                  {
                    name: portalUser.name,
                    customer: customerId,
                    contacttype: 'billing',
                    companyname: data.companyName ? data.companyName : portalUser.fullName,
                    firstname: userNameParts[0],
                    lastname: userNameParts[1] ? userNameParts[1] : '',
                    email1: portalUser.email,
                    '@refname': 'contact'
                  }
              },
            if: [
              {
                create:
                  {
                    contact:
                      {
                        name: portalUser.name,
                        customer: customerId,
                        contacttype: 'billing',
                        companyname: data.companyName ? data.companyName : portalUser.fullName,
                        firstname: userNameParts[0],
                        lastname: userNameParts[1] ? userNameParts[1] : '',
                        email1: portalUser.email,
                        '@refname': 'contact'
                      }
                  },
                '@condition': `{!contact.responsestatus!} != 'success'`
              },
            ],
            '@continueonfailure': true
          };
          fetch(paymentApi, {
            method: 'post',
            mode: 'cors',
            dataType: "json",
            body: JSON.stringify(buildRequest(sessionId, contactContent)),
          })
            .then((contactRequest) => contactRequest.ok ? contactRequest.text() : null)
            .then((contactResponse) => {
              const contact = JSON.parse(decodeURIComponent(contactResponse));
              const contactId = contact.response.content.create ? contact.response.content.create.contact.id : contact.response.content.update.contact.id;
              const salesContent = {
                create: {
                  salesdocument:
                    {
                      salesdocumenttype: 'Sales Invoice',
                      name: `${portalUser.name}-${userId}-${uniqueNum}`,
                      customer: customerId,
                      dueon: new Date(),
                      lineitems: {
                        lineitem:
                          [
                            {
                              itemdisplayname: 'Pre authorization',
                              itemname: '001',
                              price: '0',
                              quantity: '1'
                            },
                          ]
                      },
                      subtotals:
                        {
                          subtotal:
                            []
                        },
                    }
                },
                '@continueonfailure': true
              };
              fetch(paymentApi, {
                method: 'post',
                mode: 'cors',
                dataType: "json",
                body: JSON.stringify(buildRequest(sessionId, salesContent)),
              })
                .then((salesRequest) => salesRequest.ok ? salesRequest.text() : null)
                .then((salesResponse) => {
                  const saledocument = JSON.parse(decodeURIComponent(salesResponse));
                  const saledocumentId = saledocument.response.content.create ? saledocument.response.content.create.salesdocument.id : saledocument.response.content.update.salesdocument.id;
                  const transactionContent = {
                    create: {
                      transaction: {
                        account: config.tpro3.account, // Account for CC -
                        amount: '0.00',
                        salesdocument: saledocumentId,
                        transactiontype: 'Verify',
                        description: `Formio Pre Authorization - ${portalUser.name}:${userId}`,
                        customer: customerId,
                        contact: contactId,
                        creditcard: {
                          keyed: {
                            cardholdernumber: `${data.ccNumber}`,
                            cardholdername: data.cardholderName,
                            expiresmonth: data.ccExpiryMonth,
                            expiresyear: data.ccExpiryYear,
                            cvv: data.securityCode
                          }
                        },
                        '@refname': 'auth'
                      }
                    },
                    if:[
                      {
                        delete:
                          {
                            salesdocument:
                              {
                                id: saledocumentId
                              }
                          },
                        '@condition': `{!auth.responsestatus!} != 'success'`
                      }
                    ],
                    '@continueonfailure': true
                  };
                  fetch(paymentApi, {
                    method: 'post',
                    mode: 'cors',
                    dataType: "json",
                    body: JSON.stringify(buildRequest(sessionId, transactionContent)),
                  }).then((transactionRequest) => transactionRequest.ok ? transactionRequest.text() : null)
                    .then((transactionResponse) => {
                      const transaction = JSON.parse(decodeURIComponent(transactionResponse));
                      const storeContent = {
                        update: {
                          storedaccount: {
                            name: `${portalUser.name} ${data.ccNumber.replace(data.ccNumber.substring(0, 12), "***")}`, customer: customerId, contact: contactId, creditcard: {
                              keyed: {
                                cardholdernumber: `${data.ccNumber}`, cardholdername: data.cardholderName, expiresmonth: data.ccExpiryMonth, expiresyear: data.ccExpiryYear, cvv: data.securityCode
                              }
                            },
                            '@refname': 'store'
                          }
                        },
                        if: [
                          {
                            create: {
                              storedaccount: {
                                name: `${portalUser.name} ${data.ccNumber.replace(data.ccNumber.substring(0, 12), "***")}`, customer: customerId, contact: contactId, creditcard: {
                                  keyed: {
                                    cardholdernumber: `${data.ccNumber}`, cardholdername: data.cardholderName, expiresmonth: data.ccExpiryMonth, expiresyear: data.ccExpiryYear, cvv: data.securityCode
                                  }
                                }
                              }
                            },
                            '@condition': `{!store.responsestatus!} != 'success'`
                          }
                        ],
                        '@continueonfailure': true
                      };
                      fetch(paymentApi, {
                        method: 'post',
                        mode: 'cors',
                        dataType: "json",
                        body: JSON.stringify(buildRequest(sessionId, storeContent)),
                      }).then((stored) => stored.ok ? stored.text() : null)
                        .then(() => {
                          next(transaction.response.content.create.transaction);
                        })
                    })
                });
            });
        });
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
            if (process.env.TEST_SUITE) {
              txn.data = {
                cardholderName: transaction.cardholdername,
                // Replace all but last 4 digits with *'s
                ccNumber: transaction.cardholdernumber.replace(/^.{12}/g, ''),
                ccExpiryMonth: data.ccExpiryMonth,
                ccExpiryYear: data.ccExpiryYear, // TODO: Change the value from 2 digits to 4 i.e 2023
                cardType: transaction.ccType,
                transactionTag: 'approved', // TODO: Add Text field in the Transactions Record Resource
                transactionId: '00132', // TODO: Add Text field in the Transactions Record Resource
              };
              txn.save();
              return res.sendStatus(200);
            }
            if (transaction && transaction['@responsestatus'] !== 'success') {
              // Update the transaction record.
              txn.metadata.failures++;
              txn.markModified('metadata');
              txn.save();
              res.status(400);
              if (transaction.errors && transaction.errors.error) {
                return res.send(`Transaction Failed: ${transaction.errors.error.description.replace(/\+/g, ' ')}: code: ${transaction.errors.error.number}`);
              }
              return res.send(`Transaction Failed: ${transaction.errors.error.description.replace(/\+/g, ' ')}`);
            }

            if (!transaction.id) {
              res.status(400);
              return res.send('Card Information Missing in the transaction');
            }

            txn.data = {
              cardholderName: transaction.accountholder.replace(/\+/g, ' '),
              // Replace all but last 4 digits with *'s
              ccNumber: transaction.hash.replace(/#/g, '*'),
              ccExpiryMonth: data.ccExpiryMonth,
              ccExpiryYear: data.ccExpiryYear, // TODO: Change the value from 2 digits to 4 i.e 2023
              cardType: transaction['cardtype.name'],
              transactionTag: transaction.authorizationcode, // TODO: Add Text field in the Transactions Record Resource
              transactionStatus: transaction['@responsestatus'], // TODO: Add Text field in the Transactions Record Resource
              transactionId: transaction.id, // TODO: Add Text field in the Transactions Record Resource
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
