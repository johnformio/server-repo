/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');

const docker = process.env.DOCKER;
const customer = process.env.CUSTOMER;

module.exports = (app, template, hook) => {
  describe('Closed Source Actions', () => {
    describe('SQL Connector', () => {
      if (docker || customer) {
        return;
      }

      const helper = new template.Helper(template.formio.owner);
      let project;
      it('Create the test project', (done) => {
        helper
          .project()
          .plan('basic')
          .resource([
            {
              input: true,
              label: 'First Name',
              key: 'firstName',
              type: 'textfield',
            },
            {
              input: true,
              label: 'Last Name',
              key: 'lastName',
              type: 'textfield',
            },
          ])
          .action({
            title: 'SQLConnector',
            name: 'sqlconnector',
            priority: 1,
            handler: ['after'],
            method: ['create', 'read', 'update', 'delete', 'index'],
            settings: {
              fields: [
                {
                  field: {
                    input: true,
                    label: 'First Name',
                    key: 'firstName',
                    type: 'textfield',
                  },
                  column: 'firstName',
                },
                {
                  field: {
                    input: true,
                    label: 'Last Name',
                    key: 'lastName',
                    type: 'textfield',
                  },
                  column: 'lastName',
                },
              ],
              primary: 'id',
              table: 'customers',
            },
          })
          .execute(() => {
            helper.getProject((err, response) => {
              if (err) {
                return done(err);
              }

              assert(typeof response === 'object');
              project = response;

              done();
            });
          });
      });

      it('A project on the basic plan cannot access the /sqlconnector endpoint', (done) => {
        request(app)
          .get(`/project/${project._id}/sqlconnector`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /text/)
          .expect(402)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.text;
            assert.equal(response, 'Payment Required');

            done();
          });
      });

      it('Update the project to the independent plan', (done) => {
        helper
          .plan('independent')
          .execute(done);
      });

      it('A project on the independent plan cannot access the /sqlconnector endpoint', (done) => {
        request(app)
          .get(`/project/${project._id}/sqlconnector`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /text/)
          .expect(402)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.text;
            assert.equal(response, 'Payment Required');

            done();
          });
      });

      it('Update the project to the team plan', (done) => {
        helper
          .plan('team')
          .execute(done);
      });

      it('Add the sqlconnector project settings', (done) => {
        helper
          .settings({
            cors: '*',
            sqlconnector: {
              host: 'example.com',
              type: 'mysql',
            },
          })
          .execute(done);
      });

      it('A project on the team plan can access the /sqlconnector endpoint', (done) => {
        request(app)
          .get(`/project/${project._id}/sqlconnector`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert(Array.isArray(response));
            assert.equal(response.length, 5);
            response.forEach((item) => {
              assert.deepEqual(['endpoint', 'method', 'query'], Object.keys(item));
              assert(['POST', 'GET', 'PUT', 'DELETE', 'INDEX'].includes(item.method));
            });

            done();
          });
      });
    });
  });

  describe('x- headers for actions', () => {
    const helper = new template.Helper(template.formio.owner);
    let submissionUrl;
    let email1Id;
    let email2Id;
    const incorrectId = '000000000000000000000000';
    const token = '123123123123123123123';

    it('Create the test project', (done) => {
      helper
        .project()
        .plan('basic')
        .settings({
          keys: [
            {
              name: 'API Token',
              key: token,
            },
          ],
        })
        .form('test', [
          {
            input: true,
            label: 'First Name',
            key: 'firstName',
            type: 'textfield',
          },
          {
            input: true,
            label: 'Last Name',
            key: 'lastName',
            type: 'textfield',
          },
        ])
        .action({
          name: 'email',
          title: 'Email 1',
          priority: 0,
          method: ['create'],
          handler: ['after'],
          settings: {
            transport: 'test',
            from: 'no-reply@form.io',
            emails: 'user1@form.io',
            subject: 'Email 1 Action',
            message: 'Email 1',
          },
        })
        .action({
          name: 'email',
          title: 'Email 2',
          priority: 0,
          method: ['create'],
          handler: ['after'],
          settings: {
            transport: 'test',
            from: 'no-reply@form.io',
            emails: 'user2@form.io',
            subject: 'Email 2 Action',
            message: 'Email 2',
          },
        })
        .execute(() => {
          submissionUrl = `/project/${helper.template.project._id}/form/${helper.template.forms.test._id}/submission`;
          email1Id = helper.template.actions.test[0]._id;
          email2Id = helper.template.actions.test[1]._id;

          done();
        });
    });

    const timeout = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

    const checkActions = ({
      headers,
      expected: {
        email1,
        email2,
        save,
      },
    }, done) => {
      const event = template.hooks.getEmitter();
      const promises = [];
      let submissionPromise;

      promises.push(Promise.race([
        new Promise((resolve, reject) => {
          event.on('newMail', (email) => {
            try {
              assert.equal(email.from, 'no-reply@form.io');
              assert.equal(email.to, 'user1@form.io');
              assert.equal(email.subject, 'Email 1 Action');
              assert.equal(email.html, 'Email 1');
              email1 ? resolve() : reject(new Error('Email 1 should not be received.'));
            }
            catch (e) {}
          });
        }),
        timeout(3000)
          .then(() => {
            if (email1) {
              throw new Error('Email 1 should be received.');
            }
          }),
      ]));

      promises.push(Promise.race([
        new Promise((resolve, reject) => {
          event.on('newMail', (email) => {
            try {
              assert.equal(email.from, 'no-reply@form.io');
              assert.equal(email.to, 'user2@form.io');
              assert.equal(email.subject, 'Email 2 Action');
              assert.equal(email.html, 'Email 2');
              email2 ? resolve() : reject(new Error('Email 2 should not be received.'));
            }
            catch (e) {}
          });
        }),
        timeout(3000)
          .then(() => {
            if (email2) {
              throw new Error('Email 2 should be received.');
            }
          }),
      ]));

      promises.push(new Promise((resolve) => {
        submissionPromise = resolve;
      }));

      Promise.all(promises)
        .then(() => {
          event.removeAllListeners('newMail');
          return done()
        })
        .catch(done);

      request(app)
        .post(submissionUrl)
        .set('x-token', token)
        .set(headers)
        .send({
          data: {
            firstName: 'Joe',
            lastName: 'Smith',
          },
        })
        .expect('Content-Type', /json/)
        .expect(save ? 201 : 200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert.equal(Boolean(response._id), save);
          assert.equal(response.data.firstName, 'Joe');
          assert.equal(response.data.lastName, 'Smith');

          submissionPromise();
        });
    };

    describe('x-actions-include header', () => {
      it('Empty header should not change behavior', (done) => {
        checkActions({
          headers: {
            'x-actions-include': '',
          },
          expected: {
            email1: true,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Single action might be executed by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'save',
          },
          expected: {
            email1: false,
            email2: false,
            save: true,
          },
        }, done);
      });

      it('Multiple actions might be executed by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'email',
          },
          expected: {
            email1: true,
            email2: true,
            save: false,
          },
        }, done);
      });

      it('Multiple actions might be executed by action names', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'email,save',
          },
          expected: {
            email1: true,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Incorrect action names ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'notexisting',
          },
          expected: {
            email1: false,
            email2: false,
            save: false,
          },
        }, done);
      });

      it('Incorrect action names not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'notexisting,save',
          },
          expected: {
            email1: false,
            email2: false,
            save: true,
          },
        }, done);
      });

      it('Single action might be executed by action Id', (done) => {
        checkActions({
          headers: {
            'x-actions-include': email1Id,
          },
          expected: {
            email1: true,
            email2: false,
            save: false,
          },
        }, done);
      });

      it('Multiple action might be executed by action Ids', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `${email1Id},${email2Id}`,
          },
          expected: {
            email1: true,
            email2: true,
            save: false,
          },
        }, done);
      });

      it('Incorrect action Ids ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-include': incorrectId,
          },
          expected: {
            email1: false,
            email2: false,
            save: false,
          },
        }, done);
      });

      it('Incorrect action Ids not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `${email1Id},${incorrectId}`,
          },
          expected: {
            email1: true,
            email2: false,
            save: false,
          },
        }, done);
      });

      it('Combination of action names and Ids might be used', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `save,${email1Id}`,
          },
          expected: {
            email1: true,
            email2: false,
            save: true,
          },
        }, done);
      });
    });

    describe('x-actions-exclude header', () => {
      it('Empty header should not change behavior', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': '',
          },
          expected: {
            email1: true,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Single action might be excluded by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'save',
          },
          expected: {
            email1: true,
            email2: true,
            save: false,
          },
        }, done);
      });

      it('Multiple actions might be excluded by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'email',
          },
          expected: {
            email1: false,
            email2: false,
            save: true,
          },
        }, done);
      });

      it('Multiple actions might be excluded by action names', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'email,save',
          },
          expected: {
            email1: false,
            email2: false,
            save: false,
          },
        }, done);
      });

      it('Incorrect action names ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'notexisting',
          },
          expected: {
            email1: true,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Incorrect action names not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'notexisting,save',
          },
          expected: {
            email1: true,
            email2: true,
            save: false,
          },
        }, done);
      });

      it('Single action might be excluded by action Id', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': email1Id,
          },
          expected: {
            email1: false,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Multiple action might be excluded by action Ids', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': `${email1Id},${email2Id}`,
          },
          expected: {
            email1: false,
            email2: false,
            save: true,
          },
        }, done);
      });

      it('Incorrect action Ids ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': incorrectId,
          },
          expected: {
            email1: true,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Incorrect action Ids not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': `${email1Id},${incorrectId}`,
          },
          expected: {
            email1: false,
            email2: true,
            save: true,
          },
        }, done);
      });

      it('Combination of action names and Ids might be used', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': `save,${email1Id}`,
          },
          expected: {
            email1: false,
            email2: true,
            save: false,
          },
        }, done);
      });
    });

    it('x-actions-exclude header should be prioritized over x-actions-exclude header', (done) => {
      checkActions({
        headers: {
          'x-actions-include': 'email',
          'x-actions-exclude': 'email',
        },
        expected: {
          email1: true,
          email2: true,
          save: false,
        },
      }, done);
    });
  });
};
