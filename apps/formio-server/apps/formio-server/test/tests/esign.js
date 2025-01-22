/* eslint-env mocha */
'use strict';

var assert = require('assert');
var _ = require('lodash');
const config = require('../../config');

module.exports = (app, template) => {
  const esignSettings = {
    signatures: [
      {
        component: 'signatures.applicantSignature',
        signAll: false,
        signedData: [
          'itemToPurchase',
          'estimatedAmount',
          'justificationForThePurchase',
        ],
      },
      {
        component: 'signatures.headOfDepartmentApproval',
        signedData: [
          'itemToPurchase',
          'estimatedAmount',
          'justificationForThePurchase',
          'signatures.applicantSignature',
        ],
        signAll: false,
      },
      {
        component: 'signatures.accountantApproval',
        signedData: ['signatures.allowedBudgetUsd'],
        signAll: false,
      },
    ],
    notDisableSignedData: true,
  };

  const helper = new template.Helper(template.formio.owner);
  let form;
  let submission;
  const submissionData1Signature = {
    itemToPurchase: 'laptop',
    estimatedAmount: '1300',
    justificationForThePurchase: 'the old is broken',
    signatures: {
      applicantSignature: 'Tanya',
      headOfDepartmentApproval: false,
      accountantApproval: '',
    },
    submit: true,
  };

  const submissionData2Signatures = {
    itemToPurchase: 'laptop',
    estimatedAmount: '1300',
    justificationForThePurchase: 'the old is broken',
    signatures: {
      applicantSignature: 'Tanya',
      headOfDepartmentApproval: true,
      accountantApproval: '',
    },
    submit: true,
  };

  const submissionData3Signatures = {
    itemToPurchase: 'laptop',
    estimatedAmount: '1300',
    justificationForThePurchase: 'the old is broken',
    signatures: {
      applicantSignature: 'Tanya',
      headOfDepartmentApproval: true,
      allowedBudgetUsd: 1500,
      accountantApproval: 'Hanna',
    },
    submit: true,
  };

  describe('eSignature', () => {
    before((done) => {
      process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'examplekey';
      process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
      const privateKey =
        'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC+GdDtAWQwtDLI\nhzGOUyTr9mv39fjEcy4VfIUItaNsMKv2uOPrsfz+A/tTMV0KjhJRIyCirmtq3bP7\nUOIfzPXA277i4RhsMbtNZ69A2GZ9QnwlXJcP/cPbmIXzXCK/Dn6Jv2WbJkLtDCP6\nERXrzKRn6PxCzHYaOF9NCU63uZV94sxRhy1VwRHcCVtzktJBKPbBdRclvoy3RJqR\nQTbZDwsBw1B0AdZzP680cJYyEhRPjvxCzfJ/ZdJfq/v+jTtgDDdFsyBzcDyNNKvO\nEot++p0g4JBYt08SbPDptLjqDNG+vc17v/EQ60NUYRZQqfcnb45ZjGHb6pZLaHQP\nLFA6AGizAgMBAAECggEAAnaQ1klS1C4O4bnyt+6MMhcsI0yHb9Ay6X9cCpaulTvK\nNp+tqwOljLWzf3VKcyplGAe1qAtM2VfMZGC8v/8RXhwwIdNwfr0O5BFdsXWRr7oj\n+VNKTSA+IJhzf97n6ll/OpIFeIMAkf66xpuLEQDtTmqz6LpVJhYokfXMFHsDR1wa\nVMloTIWGQ1BtcML9wtNI30Mj6+2Qgy5lyBeR6Tq4IkRCuVYqr2HhNzpYDTLYc6y+\nbmE5v8oPk/XOc1QO3GfkTDLE1m1lpJlZI35HWkh5kZ8zrP2Vu+TBh6BueV0iJCdd\nFihG4Uq6fVF26JZYKrPZ5ABMAXGauQQXA2oe+yaVlQKBgQD/ViektvMyYhWqyC6t\nwxIntkKp3aVHFOy0KG1FkhKDG5ayzt9UOX+0e8BmKepXSmmybCqIjuI9j+53ghlf\nEPWgFT6Lki3A3wC/tJwt9auwOxbk/k8+70gNTistbfS7+qpMx7G988aVaj+ajfrn\nzxlV2WeYfBW4FS+apGqYYeFDLwKBgQC+mESGrqJs6lf0Cq1K/EqnFaTuSoPChS2N\n7jlJUT9ZH/z8bb9Egm9075ahBVKAhMKTG+39QR1SYXyTxTSLbMHdqATs83pva/ts\n01hDveq7Bmp3FxmDGugqY2zGLsjL3nQaMlAcO0H877jN5WCZwb8BH94KBI2FClBa\n8rr3bFNhvQKBgQC7d5DxsVULN9J6qjEDaMaKm5mER/SSJL3JZCkePCoVUospSxPT\nLcgiRf2zxLCGWF8UHbB4xJc85dEKs11XXAdK+m4KYU/wXIqbNcq5P7dHU4ryo/ig\n12PKSQsQdruJzHd+mdtZAINbrj92hSmjSn1qd41E+k2j8wIZgv+0U6DlBwKBgAd8\nV4Sqqzp34ch1+uRtEEmLshSh3JbxQB7I8nsMs94+QWNwtAhuzw3asyHT4a+mhzXb\n7Pb7bblkls3++tdXCC46gScFURO7O/7ENj1C4ktCL0BKKfhaQDAaA5WtFLndHNZC\nj57sPOVATRPZJHglgej7ZW8jSqOlCg7oZat+F7BJAoGBALPcGAarPd/ZzLT7bdCT\newrAXAEgrtcGQrj59borXKh0QjAAt92gvMUayLDyUKcX19ULlVJucvXV1uBzHeUK\n+7kcONjffK5UOGx2VQaFgo0mO966IBkVtMj13bFpOfsDAzceIHPLrfwZLwm/CG+I\nilDgUSu0p6Q1lARNpeVmt0FB';
      config.esignPrivateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`;
      config.simulateEsignLicenseOption = true;
      done();
    });

    after((done) => {
      process.env.TEST_SIMULATE_SAC_PACKAGE = '0';
      config.esignPrivateKey = '';
      config.simulateEsignLicenseOption = true;
      done();
    });

    it('Creates a test project and form', (done) => {
      helper
        .project()
        .form('formWithSignatures', [
          {
            title: 'Page 1',
            label: 'Page 1',
            type: 'panel',
            key: 'page1',
            components: [
              {
                label: '1. Item to purchase',
                applyMaskOn: 'change',
                tableView: true,
                key: 'itemToPurchase',
                type: 'textfield',
                input: true,
              },
              {
                label: '2. Estimated amount, USD',
                applyMaskOn: 'change',
                tableView: true,
                key: 'estimatedAmount',
                type: 'textfield',
                input: true,
              },
              {
                label: '3. Justification for the purchase',
                applyMaskOn: 'change',
                autoExpand: false,
                tableView: true,
                key: 'justificationForThePurchase',
                type: 'textarea',
                input: true,
              },
              {
                label: 'SIGNATURES',
                hideLabel: false,
                tableView: false,
                key: 'signatures',
                type: 'container',
                input: true,
                components: [
                  {
                    label:
                      '4. Purchase Initiator Signature (ESIGNATURE - user A)',
                    applyMaskOn: 'change',
                    tableView: true,
                    key: 'applicantSignature',
                    type: 'textfield',
                    input: true,
                  },
                  {
                    label:
                      '5. Head of Department approval (ESIGNATURE - user B)',
                    tableView: false,
                    defaultValue: false,
                    key: 'headOfDepartmentApproval',
                    type: 'checkbox',
                    input: true,
                  },
                  {
                    label: '6. Allowed Budget, USD',
                    applyMaskOn: 'change',
                    mask: false,
                    tableView: false,
                    delimiter: false,
                    requireDecimal: false,
                    inputFormat: 'plain',
                    truncateMultipleSpaces: false,
                    key: 'allowedBudgetUsd',
                    type: 'number',
                    input: true,
                  },
                  {
                    label: '7. Accountant Approval (ESIGNATURE - user C)',
                    applyMaskOn: 'change',
                    autoExpand: false,
                    tableView: true,
                    key: 'accountantApproval',
                    type: 'textarea',
                    input: true,
                  },
                ],
              },
            ],
            input: false,
            tableView: false,
          },
          {
            label: 'Submit',
            showValidations: false,
            tableView: false,
            key: 'submit',
            type: 'button',
            input: true,
          },
        ])
        .execute(function () {
          form = helper.getForm('formWithSignatures');
          assert.equal(typeof form === 'object', true);
          done();
        });
    });

    it('Sets a form to use eSignature', (done) => {
      form.esign = esignSettings;
      helper.updateForm(form, (err, result) => {
        assert.deepEqual(result.esign, esignSettings);
        done();
      });
    });

    it('Should not create eSignature when revisions and submissionRevisions are not set', (done) => {
      helper.createSubmission(
        'formWithSignatures',
        {
          data: submissionData1Signature,
        },
        (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submissionData1Signature);
          assert.equal(result.eSignatures.length, 0);
          done();
        }
      );
    });

    it('Enable submission revisions for test form', (done) => {
      form.submissionRevisions = 'true';
      helper.updateForm(form, (err, result) => {
        assert.deepEqual(result.submissionRevisions, 'true');
        done();
      });
    });

    it('Should not create eSignature when for revisions are not set', (done) => {
      helper.createSubmission(
        'formWithSignatures',
        {
          data: submissionData1Signature,
        },
        (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submissionData1Signature);
          assert.equal(result.eSignatures.length, 0);
          done();
        }
      );
    });

    it('Enable form revisions for test form', (done) => {
      form.revisions = 'original';
      helper.updateForm(form, (err, result) => {
        assert.deepEqual(result.revisions, 'original');
        done();
      });
    });

    if (config.formio.hosted) {
      it('Should not create eSignature for hosted', (done) => {
        helper.createSubmission(
          'formWithSignatures',
          {
            data: submissionData1Signature,
          },
          (err, result) => {
            if (err) {
              return done(err);
            }
            assert.deepEqual(result.data, submissionData1Signature);
            assert.equal(result.eSignatures.length, 0);
            done();
          }
        );
      });
    }

    if (!config.formio.hosted) {
      it('Should create an eSignature for the first signed field', (done) => {
        helper.createSubmission(
          'formWithSignatures',
          {
            data: submissionData1Signature,
          },
          (err, result) => {
            if (err) {
              return done(err);
            }
            assert.deepEqual(result.data, submissionData1Signature);
            assert.equal(result.eSignatures.length, 1);
            const eSignature = result.eSignatures[0];
            assert.equal(eSignature.valid, true);
            assert.equal(eSignature._sid, result._id);
            assert.equal(
              eSignature.signature.user.data,
              helper.owner.data.email
            );
            assert.equal(eSignature.signature.user._id, helper.owner._id);
            assert.equal(
              eSignature.signature.compPath,
              'signatures.applicantSignature'
            );
            assert.equal(
              eSignature.signature.valuePath,
              'signatures.applicantSignature'
            );
            assert.equal(eSignature.signature.submission._rid, result._id);
            assert.equal(eSignature.signature.submission.form, form._id);
            assert.equal(!!eSignature.signature.submission.data, false);
            submission = result;
            done();
          }
        );
      });

      it('Should create an eSignature for the second signed field and leave a first eSignature valid', (done) => {
        submission.data = submissionData2Signatures;

        helper.updateSubmission(submission, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submissionData2Signatures);
          assert.equal(result.eSignatures.length, 2);
          const eSignature1 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const eSignature2 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const oldSignature1 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          assert.equal(eSignature1.valid, true);
          assert.deepEqual(eSignature1, oldSignature1);
          assert.equal(eSignature2.valid, true);
          assert.equal(eSignature2._sid, result._id);
          assert.equal(
            eSignature2.signature.compPath,
            'signatures.headOfDepartmentApproval'
          );
          assert.equal(
            eSignature2.signature.valuePath,
            'signatures.headOfDepartmentApproval'
          );
          assert.equal(eSignature2.signature.submission._rid, result._id);
          assert.equal(eSignature2.signature.submission.form, form._id);
          submission = result;
          done();
        });
      });

      it('Should create an eSignature for the third signed field and leave the first and second eSignatures valid', (done) => {
        submission.data = submissionData3Signatures;

        helper.updateSubmission(submission, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submissionData3Signatures);
          assert.equal(result.eSignatures.length, 3);
          const eSignature1 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const eSignature2 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const eSignature3 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.accountantApproval'
          );
          const oldSignature1 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const oldSignature2 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          assert.equal(eSignature1.valid, true);
          assert.equal(eSignature2.valid, true);
          assert.equal(eSignature3.valid, true);
          assert.deepEqual(eSignature1, oldSignature1);
          assert.deepEqual(eSignature2, oldSignature2);
          assert.equal(eSignature3._sid, result._id);
          assert.equal(
            eSignature3.signature.compPath,
            'signatures.accountantApproval'
          );
          assert.equal(
            eSignature3.signature.valuePath,
            'signatures.accountantApproval'
          );
          assert.equal(eSignature3.signature.submission._rid, result._id);
          assert.equal(eSignature3.signature.submission.form, form._id);
          submission = result;
          done();
        });
      });

      it('Should create a new eSignatures when the data confirmed by the old ones is changed ', (done) => {
        submission.data.itemToPurchase = 'chair';

        helper.updateSubmission(submission, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submission.data);
          assert.equal(result.eSignatures.length, 3);
          const eSignature1 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const eSignature2 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const eSignature3 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.accountantApproval'
          );
          const oldSignature1 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const oldSignature2 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const oldSignature3 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.accountantApproval'
          );
          assert.equal(eSignature1.valid, true);
          assert.equal(eSignature2.valid, true);
          assert.equal(eSignature3.valid, true);
          assert.equal(eSignature1._id !== oldSignature1._id, true);
          assert.equal(eSignature2._id !== oldSignature2._id, true);
          assert.equal(eSignature3._id, oldSignature3._id);

          submission = result;
          done();
        });
      });

      it('Should create a new eSignature for Accountant Approval when the data confirmed by the old one is changed ', (done) => {
        submission.data.signatures.allowedBudgetUsd = 2500;

        helper.updateSubmission(submission, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submission.data);
          assert.equal(result.eSignatures.length, 3);
          const eSignature1 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const eSignature2 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const eSignature3 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.accountantApproval'
          );
          const oldSignature1 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const oldSignature2 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const oldSignature3 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.accountantApproval'
          );
          assert.equal(eSignature1.valid, true);
          assert.equal(eSignature2.valid, true);
          assert.equal(eSignature3.valid, true);
          assert.equal(eSignature1._id === oldSignature1._id, true);
          assert.equal(eSignature2._id === oldSignature2._id, true);
          assert.equal(eSignature3._id !== oldSignature3._id, true);

          submission = result;
          done();
        });
      });

      it('Should remove the eSignature for Accountant Approval when the signature field is empty', (done) => {
        submission.data.signatures.accountantApproval = '';

        helper.updateSubmission(submission, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submission.data);
          assert.equal(result.eSignatures.length, 2);
          const eSignature1 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const eSignature2 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );
          const eSignature3 = _.find(
            result.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.accountantApproval'
          );
          const oldSignature1 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.applicantSignature'
          );
          const oldSignature2 = _.find(
            submission.eSignatures,
            (esign) =>
              esign.signature.compPath === 'signatures.headOfDepartmentApproval'
          );

          assert.equal(eSignature1.valid, true);
          assert.equal(eSignature2.valid, true);
          assert.equal(eSignature1._id === oldSignature1._id, true);
          assert.equal(eSignature2._id === oldSignature2._id, true);
          assert.equal(!!eSignature3, false);

          submission = result;
          done();
        });
      });

      it('Changes a form to use new field as a signture with signAll enabled', (done) => {
        form.components.push({
          label: 'New Signature',
          applyMaskOn: 'change',
          tableView: true,
          key: 'newSignature',
          type: 'textfield',
          input: true,
        });

        form.esign = {
          signatures: [
            {
              component: 'newSignature',
              signAll: true,
            },
          ],
          notDisableSignedData: true,
        };

        helper.updateForm(form, (err, result) => {
          assert.deepEqual(result.esign, form.esign);
          form = result;
          done();
        });
      });

      it('Should create an eSignature for the New Signature field', (done) => {
        const data = submissionData3Signatures;
        data.newSignature = 'signed';
        helper.createSubmission(
          'formWithSignatures',
          {
            data,
          },
          (err, result) => {
            if (err) {
              return done(err);
            }
            assert.deepEqual(result.data, data);
            assert.equal(result.eSignatures.length, 1);
            const eSignature = result.eSignatures[0];
            assert.equal(eSignature.valid, true);
            assert.equal(eSignature._sid, result._id);
            assert.equal(
              eSignature.signature.user.data,
              helper.owner.data.email
            );
            assert.equal(eSignature.signature.user._id, helper.owner._id);
            assert.equal(eSignature.signature.compPath, 'newSignature');
            assert.equal(eSignature.signature.valuePath, 'newSignature');
            assert.equal(eSignature.signature.submission._rid, result._id);
            assert.equal(eSignature.signature.submission.form, form._id);
            assert.equal(!!eSignature.signature.submission.data, false);
            submission = result;
            done();
          }
        );
      });

      it('Should create a new eSignature when the data has changed and signAll is enabled', (done) => {
        submission.data.itemToPurchase = 'car';

        helper.updateSubmission(submission, (err, result) => {
          if (err) {
            return done(err);
          }
          assert.deepEqual(result.data, submission.data);
          assert.equal(result.eSignatures.length, 1);
          const eSignature = result.eSignatures[0];
          assert.equal(eSignature._id !== submission.eSignatures[0]._id, true);

          submission = result;
          done();
        });
      });

      it('Should attach eSignatures to multiple submissions', (done) => {
        helper.getSubmissions(form.name, (err, formsubs) => {
          if (err) {
            return done(err);
          }

          _.each(formsubs, (subm) => {
            _.each(subm.eSignatures, (esign) =>
              assert.equal(esign.valid, true)
            );
          });
          done();
        });
      });
    }
  });
};
