/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');
const MockServer = require('./fixtures/MockServer');
const config = require("../../config");
const sqlConnectorMockServer = require('./fixtures/sqlConnectorMockServer');
const _ = require('lodash');
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
      const sqlConnectorActionSettings = {
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
      };

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
          .action(sqlConnectorActionSettings)
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

      if (config.formio.hosted) {
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

        it('A project on the basic plan cannot access the /sqlconnector?format=v2 endpoint', (done) => {
          request(app)
            .get(`/project/${project._id}/sqlconnector?format=v2`)
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

        it('A project on the independent plan cannot access the /sqlconnector?format=v2 endpoint', (done) => {
          request(app)
            .get(`/project/${project._id}/sqlconnector?format=v2`)
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

        it('A project on the team plan can access the /sqlconnector?format=v2 endpoint'  , (done) => {
          request(app)
            .get(`/project/${project._id}/sqlconnector?format=v2`)
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
                assert.deepEqual(['endpoint', 'db', 'method', 'query'], Object.keys(item));
                assert(['POST', 'GET', 'PUT', 'DELETE', 'INDEX'].includes(item.method));
                const {primary, table, fields} = sqlConnectorActionSettings.settings;
                const [param1, param2] = fields;
                const column1 = param1.column;
                const column2 = param2.column


                switch (item.method) {
                  case 'GET':
                    if(item.endpoint === '/customers/:id'){
                      assert.deepEqual(item.query[0], [ 'select * from `'+ table +'` where `'+ primary +'` = ?', 'params.' + primary ] )
                    } else if (item.endpoint === '/customers') {
                      assert.deepEqual(item.query[0], [ 'select * from `' + table + '`'])
                    } else {
                      assert.fail('Wrong endpoint for get method')
                    }
                    break;
                  case 'POST':
                    assert.equal(item.endpoint, '/' + table);
                    assert.deepEqual(item.query[0], [ 'insert into `'+ table +'` (`' + column1 + '`, `' + column2 + '`) values (?, ?)',
                                                      'body.data.' + column1,
                                                      'body.data.' + column2] );
                     assert.deepEqual(item.query[1], [ 'select * from `customers` where ' + primary + ' = LAST_INSERT_ID()' ])
                    break;
                  case 'PUT':
                    assert.equal(item.endpoint, '/' + table +'/:id');
                    assert.deepEqual(item.query[0], [ 'update `'+ table +'` set `firstName` = ?, `' + column2 + '` = ? where `' + primary + '` = ?',
                                                      'body.data.' + column1,
                                                      'body.data.' + column2,
                                                      'params.' + primary
                                                    ] );
                    assert.deepEqual(item.query[1], [ 'select * from `' + table + '` where `'+ primary +'` = ?', 'params.' + primary])
                    break;
                  case 'DELETE':
                    assert.equal(item.endpoint, '/' + table +'/:id');
                    assert.deepEqual(item.query[0], [ 'delete from `'+ table +'` where `'+ primary +'` = ?', 'params.' + primary ] )
                    break;
                  default:
                    assert.fail('Wrong method')
                }

              });

              done();
            });
        });
      }
    });

    describe('Webhook (Premium)', () => {
      if (docker) {
        return;
      }
      const helper = new template.Helper(template.formio.owner);

      let webhookForm = {
        title: 'Webhook Sender',
        name: 'webhookSender',
        path: 'webhookSender',
        type: 'form',
        access: [],
        submissionAccess: [
          {
            type: "create_own",
            roles: [
                "000000000000000000000000"
            ]
        },
        ],
        components: [
          {
            type: 'textfield',
            key: 'player',
            inputType: 'text',
            input: true,
          },

        ],
      };
      let project;
      let testWebhookUrl;
      let webhookAction;
      const webhookListener = new MockServer();

      describe('Blocking webhooks', () => {
        describe('After handled webhooks', () => {

          before('Set up webhook listener', (done) => {
            // create the webhook listener child process
            webhookListener.setup("webhookServer.js", 'http', 1337, '/player', 201, {records: [{playerId: '123456'}]})
              .then((url) => {
                testWebhookUrl = url;
                done();
              })
          });

          before('Set up the project', (done) => {
            helper
              .project()
              .plan('commercial')
              .execute(() => {
                const projectId = helper.template.project._id;
                // add the public configurations
                request(app)
                  .put(`/project/${projectId}`)
                  .set('x-jwt-token', template.formio.owner.token)
                  .send({
                    config: {
                      myTestConfig: "Hello, world!"
                    }
                  })
                  .expect(200)
                  .expect("Content-Type", /json/)
                  .end((err, res) => {
                    if (err) {
                      done(err);
                    }
                    assert(res.body.hasOwnProperty("config"), 'Test project should have public configurations');
                    project = res.body;
                    done();
                  })
              });
          })

          afterEach('Clear in-memory webhook responses', () => {
            webhookListener.clearReceivedHooks();
          });

          after('Stop the webhook listener process', () => {
            webhookListener.stop();
          });

          it('Should create the form and action for the after handled webhook tests', (done) => {
            request(app)
              .post(`/project/${project._id}/form`)
              .set('x-jwt-token', template.formio.owner.token)
              .send(webhookForm)
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }
                webhookForm = res.body;
                template.formio.owner.token = res.headers['x-jwt-token'];
                request(app)
                  .post(`/project/${project._id}/form/${webhookForm._id}/action`)
                  .set('x-jwt-token', template.formio.owner.token)
                  .send({
                    title: 'Test Webhook',
                    name: 'webhook',
                    form: webhookForm._id.toString(),
                    handler: ['after'],
                    method: ['create', 'update', 'delete'],
                    priority: 1,
                    settings: {
                      url: testWebhookUrl,
                      username: '',
                      password: '',
                      transform: 'payload = { player: payload.submission.data.player, playerId: externalId }',
                      block: true,
                      externalIdType: 'fake_baseball',
                      externalIdPath: 'records[0].playerId',
                      headers: [
                        {
                          header: "x-test-header",
                          value: "hello, world!"
                        },
                        {
                          header: "x-test-header-data",
                          value: "{{data.player}}"
                        },
                        {
                          header: "x-test-header-config",
                          value: "{{config.myTestConfig}}"
                        },
                        {
                          header: "x-test-header-undefined",
                          value: "{{doesNotExist.foo}}"
                        }
                      ]
                    }
                  })
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) {
                      return done(err);
                    }
                    webhookAction = res.body
                    template.formio.owner.token = res.headers['x-jwt-token'];

                    done();
                  });
              });
          });

          it('Should correctly transform webhook payload', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.deepEqual(webhookListener.hooksReceived[0].body, {player: 'Jason Giambi', playerId: ''});
                done();
              });
          });

          it('Should correctly forward headers', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header'], 'hello, world!')
                done();
              });
          });

          it('Should interpolate custom headers from the submission data', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header-data'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header-data'], 'Jason Giambi')
                done();
              });
          });

          it('Should interpolate custom headers from the project public configurations', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header-config'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header-config'], 'Hello, world!')
                done();
              });
          });

          it('Should interpolate custom headers as `undefined` if they cannot be interpolated', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header-undefined'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header-undefined'], 'undefined');
                done();
              });
          });

          it('Should return a submission response that contains externalIds and metadata with webhook response', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(res.body.externalIds[0].id, '123456');
                assert.deepEqual(res.body.metadata['Test Webhook'], {
                  records: [
                    {
                      playerId: '123456'
                    }
                  ]
                });
                done();
              });
          });
        });

      describe('Before handled webhooks', () => {
          before('Set up webhook listener', (done) => {
            // create the webhook listener child process
            webhookListener.setup("webhookServer.js", 'http', 1337, '/player', 201, {records: [{playerId: '123456'}]})
              .then((url) => {
                console.log("Done with setup!");
                testWebhookUrl = url;
                done();
              })
          });

          afterEach('Clear in-memory webhook responses', () => {
            webhookListener.clearReceivedHooks();
          });

          after('Stop the webhook listener process', () => {
            webhookListener.stop();
          });

          it('Should update the action for the before handled webhook tests', (done) => {
            request(app)
              .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                ...webhookAction,
                settings: {
                  ...webhookAction.settings,
                  handler: ['before']
                }
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }
                webhookAction = res.body;
                template.formio.owner.token = res.headers['x-jwt-token'];

                done();
              });
          });

          it('Should correctly transform webhook payload', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.deepEqual(webhookListener.hooksReceived[0].body, {player: 'Jason Giambi', playerId: ''});
                done();
              });
          });

          it('Should correctly forward headers', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header'], 'hello, world!')
                done();
              });
          });

          it('Should interpolate custom headers from the submission data', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header-data'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header-data'], 'Jason Giambi')
                done();
              });
          });

          it('Should interpolate custom headers from the project public configurations', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header-config'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header-config'], 'Hello, world!')
                done();
              });
          });

          it('Should interpolate custom headers as `undefined` if they cannot be interpolated', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(webhookListener.hooksReceived[0].headers.hasOwnProperty('x-test-header-undefined'), true);
                assert.equal(webhookListener.hooksReceived[0].headers['x-test-header-undefined'], 'undefined');
                done();
              });
          });


          it('Should return a submission response that contains externalIds and metadata with webhook response', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.equal(res.body.externalIds[0].id, '123456');
                assert.deepEqual(res.body.metadata['Test Webhook'], {
                  records: [
                    {
                      playerId: '123456'
                    }
                  ]
                });
                done();
              });
          });
        });

        describe('Webhook with query parameters in Request URL', () => {
          before('Set up webhook listener', (done) => {
            // create the webhook listener child process
            webhookListener.setup("webhookServer.js", 'http', 1337, '/player', 201, {records: [{playerId: '123456'}]})
              .then((url) => {
                console.log("Done with setup!");
                testWebhookUrl = url;
                done();
              })
          });

          afterEach('Clear in-memory webhook responses', () => {
            webhookListener.clearReceivedHooks();
          });

          after('Stop the webhook listener process', () => {
            webhookListener.stop();
          });

          it('The Webhook feature should not strip off parameters from the Request URL due POST request', (done) => {
            request(app)
              .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                ...webhookAction,
                settings: {
                  ...webhookAction.settings,
                  url: `${testWebhookUrl}?test=1`,
                  method: 'post',
                }
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }
                webhookAction = res.body;
                template.users.admin.token = res.headers['x-jwt-token'];

                request(app)
                .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
                .set('x-jwt-token', template.formio.owner.token)
                .send({
                  data: {
                    player: 'Jason Giambi'
                  },
                })
                .expect(201)
                .expect('Content-Type', /json/)
                .end((err, res)=>{
                  if(err){
                    return done(err)
                  }
                  assert.equal(webhookListener.hooksReceived[1].url, `/player?test=1`);
                  done();
                });
              });
          });

          it('The Webhook feature should not strip off parameters from the Request URL due PUT request', (done) => {
            request(app)
              .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                ...webhookAction,
                settings: {
                  ...webhookAction.settings,
                  method: 'put',
                }
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }
                webhookAction = res.body;
                template.users.admin.token = res.headers['x-jwt-token'];

                request(app)
                .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
                .set('x-jwt-token', template.formio.owner.token)
                .send({
                  data: {
                    player: 'Jason Giambi'
                  },
                })
                .expect(201)
                .expect('Content-Type', /json/)
                .end((err, res)=>{
                  if(err){
                    return done(err)
                  }
                  assert.equal(webhookListener.hooksReceived[0].url, `/player?test=1`);
                  done();
                });
              });
          });
        });

        describe('Webhook with delete request and query parameters in url', () => {
          before('Set up webhook listener', (done) => {
            // create the webhook listener child process
            webhookListener.setup("webhookServer.js", 'http', 1337, '/player', 201, {records: [{playerId: '123456'}]})
              .then((url) => {
                console.log("Done with setup!");
                testWebhookUrl = url;
                done();
              })
          });

          afterEach('Clear in-memory webhook responses', () => {
            webhookListener.clearReceivedHooks();
          });

          after('Stop the webhook listener process', () => {
            webhookListener.stop();
          });

          it('Should update the action for the before handled webhook tests', (done) => {
            request(app)
              .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                ...webhookAction,
                settings: {
                  ...webhookAction.settings,
                  url: `${testWebhookUrl}?test=1`,
                  method: 'delete'
                }
              })
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }
                webhookAction = res.body;
                template.users.admin.token = res.headers['x-jwt-token'];

                done();
              });
          });

          it('Should build the webhook url with query parameters for delete request correctly', (done) => {
            request(app)
              .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
              .set('x-jwt-token', template.formio.owner.token)
              .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(201)
              .expect('Content-Type', /json/)
              .end((err, res)=>{
                if(err){
                  return done(err)
                }
                assert.equal(webhookListener.hooksReceived[0].url, `/player?formId=${webhookForm._id}&test=1`);
                done()
              });
          });
        });
      });

      describe('Unsuccessful webhooks without error message parameter but with error data', () => {
        let testWebhookUrl;

        before('Set up new error-responding listener', (done) => {
          // create the webhook listener child process
          webhookListener.setup("webhookServer.js", 'http', 1337, '/shouldError', 401, {error: true, myCustomParameter: `The operation 'twas not successful.`})
            .then((url) => {
              testWebhookUrl = url;
              done();
            });
        })

        afterEach('Clear in-memory webhook responses', () => {
          webhookListener.clearReceivedHooks();
        });

        after('Stop the webhook listener process', () => {
          webhookListener.stop();
        });

        it('Should transparently pass error object if `message` property does not exist on webhook response', (done) => {
          request(app)
            .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
            .set('x-jwt-token', template.formio.owner.token)
            .send({
              ...webhookAction,
              settings: {
                ...webhookAction.settings,
                handler: ['after'],
                url: testWebhookUrl,
                method: ""
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              webhookAction = res.body;
              template.formio.owner.token = res.headers['x-jwt-token'];
              request(app)
                .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
                .set('x-jwt-token', template.formio.owner.token)
                .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(401)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }

                assert.deepEqual(res.body, {error: true, myCustomParameter: `The operation 'twas not successful.`});
                done();
              });
            });
        });
      });

      describe('Unsuccessful webhooks without error message parameter and without error data', () => {
        let testWebhookUrl;

        before('Set up new error-responding listener', (done) => {
          // create the webhook listener child process
          webhookListener.setup("webhookServer.js", 'http', 1337, '/shouldError', 405)
            .then((url) => {
              testWebhookUrl = url;
              done();
            });
        })

        afterEach('Clear in-memory webhook responses', () => {
          webhookListener.clearReceivedHooks();
        });

        after('Stop the webhook listener process', () => {
          webhookListener.stop();
        });

        it('Should transparently pass error status text if `message` property nor object exist on webhook response', (done) => {
          request(app)
            .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
            .set('x-jwt-token', template.formio.owner.token)
            .send({
              ...webhookAction,
              settings: {
                ...webhookAction.settings,
                handler: ['after'],
                url: testWebhookUrl,
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              webhookAction = res.body;
              template.formio.owner.token = res.headers['x-jwt-token'];
              request(app)
                .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
                .set('x-jwt-token', template.formio.owner.token)
                .send({
                data: {
                  player: 'Jason Giambi'
                },
              })
              .expect(405)
              .expect('Content-Type', /json/)
              .end((err, res) => {
                if (err) {
                  return done(err);
                }
                assert.deepEqual(res.text, '"Method Not Allowed"');
                done();
              });
            });
        });
      });

      describe('Retry request for webhook', ()=> {
        before('Set up webhook listener', (done) => {
          webhookListener.setup("webhookServer.js", 'http', 1337, '/retry', 500)
            .then((url) => {
              testWebhookUrl = url;
              done();
            })
        });

        afterEach('Clear in-memory webhook responses', () => {
          webhookListener.clearReceivedHooks();
        });

        after('Stop the webhook listener process', () => {
          webhookListener.stop();
        });

        it('Should retry request, if it fails', (done) => {
          const numberOfAttempts = 4;
          request(app)
          .put(`/project/${project._id}/form/${webhookForm._id}/action/${webhookAction._id}`)
            .set('x-jwt-token', template.formio.owner.token)
            .send({
              ...webhookAction,
              settings: {
                username: '',
                password: '',
                url: testWebhookUrl,
                block: true,
                retryType: 'constant',
                numberOfAttempts,
                initialDelay: 100
              }
            })
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              webhookAction = res.body;
              template.formio.owner.token = res.headers['x-jwt-token'];
              const submission = { player: 'Rafayel' };
              request(app)
                .post(`/project/${project._id}/form/${webhookForm._id}/submission`)
                .set('x-jwt-token', template.formio.owner.token)
                .send({
                  data: submission
                })
                .expect(201)
                .expect('Content-Type', /json/)
                .end(async(err, res) => {
                  if (err) {
                    return done(err);
                  }
                  assert.deepEqual(submission, res.body.data);
                  assert.equal(_.get(res.body, `metadata.${webhookAction.title}.attempts`), numberOfAttempts, 'The number of attempts should not exceed the set number of attempts');
                  done();
                });
            })
        })
      })
    });

    describe('LDAP Login', () => {
      if (docker || customer) {
        return;
      }
      const helper2 = new template.Helper(template.formio.owner);
      let project2;
      let testLdapUrl;
      const ldapListener = new MockServer();
      before('Set up ldap listener', (done) => {
        // create the webhook listener child process
        ldapListener.setup('ldapServer.js', 'ldap', 1389)
          .then((url) => {
            testLdapUrl = url;
            done();
          })
      });
      it('Create an ldap test project', (done) => {
        helper2
          .project()
          .plan('commercial')
          .execute(() => {
            helper2.getProject((err, response) => {
              if (err) {
                return done(err);
              }

              assert(typeof response === 'object');
              project2 = response;
              done();
            });
          });
      });

      it('Create ldap form and action', (done) => {
        helper2
        .form('ldap', [
          {
            input: true,
            label: 'User Name',
            key: 'username',
            type: 'textfield',
          },
          {
            input: true,
            label: 'Password',
            key: 'password',
            type: 'password',
          },
        ],
        {
          submissionAccess: [
            {
              type: 'create_own',
              roles: ['anonymous']
            }
          ]
        })
        .action('ldap', {
          title: 'LDAP',
          name: 'ldap',
          priority: 3,
          handler: ['before'],
          method: ['create'],
          settings: {
            passthrough: false,
            passwordField: 'password',
            usernameField: 'username',
            roles: [
              {
                property: '',
                role: helper2.template.roles.authenticated._id,
                value: ''
              }
            ]
          },
        })
        .execute(done);
      });

      it('Add the ldap project settings', (done) => {
        helper2
          .settings({
            cors: '*',
            ldap: {
              "url": testLdapUrl,
              "bindDn": "dc=example,dc=com",
              "bindCredentials": "password",
              "searchBase": "dc=example,dc=com",
              "searchFilter": "(uid={{username}})"
            },
          })
          .execute(done);
      });

      it('Should allow you to login as an ldap user', (done) => {
        request(app)
          .post(`/project/${project2._id}/ldap`)
          .send({
            data: {
              username: 'einstein',
              password: 'password'
            }
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            assert.equal(res.body._id, 'einstein');
            assert.equal(res.body.roles.length, 1);
            assert.equal(res.body.roles[0], helper2.template.roles.authenticated._id.toString());
            assert.equal(res.body.data.mail, 'einstein@example.com');
            done();
          });
      });

      after('Stop the ldap listener process', () => {
        ldapListener.stop();
      });
    });
  })

  describe('SQL Connector', function() {
    const sqlConnectorPort = 3002;
    let testTemplate = require('./fixtures/sqlConnectorTemplate.json');
    let _template = _.cloneDeep(testTemplate);
    let projectApiKey = _template.settings.keys[0].key;
    let importedProject = {};
    let createdObjectId;
    let submissionPayload = {
      data: {
        firstname: "John",
        email: "john@smith.com",
        submit: true,
      }
    };
    let server;

    it('Should be able to bootstrap form/resource with SQL Action', function(done) {
      importer.import.template(_template, alters, (err, template) => {
        if (err) {
          return done(err);
        }
        importedProject = template;
        done();
      });
    });

    it('Should set SQL connector project settings', (done) => {
      importedProject.settings = _template.settings

      request(app)
        .put(`/${importedProject.name}`)
        .set('x-admin-key', process.env.ADMIN_KEY)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(importedProject)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          
          assert.deepEqual(
            _template.settings,
            JSON.parse(res.text).settings
          );
          
          done();
        });
    });

    it('Return 502 error if server is not available (ECONNREFUSED)', (done) => {
      request(app)
        .post(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(submissionPayload)
        .expect(502)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert.equal(
            502,
            res.status
          );

          done();
        });
    });

    it('Set up sqlconnector listener', (done) => {
      server = sqlConnectorMockServer.listen(sqlConnecjtorPort, () => {
        console.log(`Listening on ${sqlConnecjtorPort}`);
        done();
      });
    });

    after('Stop the sqlconnector listener process', () => {
      server.close();
    });

    it('Returns 400 when invalid request body', (done) => {
      request(app)
        .post(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(submissionPayload)
        .expect(400)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(
            "Bad Request",
            JSON.parse(res.text).message
          );

          done();
        });
    });

    it('Returns 201 when creating a submission w/ AFTER handler', (done) => {
      submissionPayload.data.age = 123

      request(app)
        .post(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(submissionPayload)
        .expect(201)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          createdObjectId = JSON.parse(res.text)._id;
          done();
        });
    });

    it('Returns 200 when updating a submission w/ AFTER handler', (done) => {
      submissionPayload.data.age = 234

      request(app)
        .put(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission/${createdObjectId}`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(submissionPayload)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(
            submissionPayload.data.age,
            JSON.parse(res.text).data.age
          );

          done();
        });
    });

    it('Returns 200 when deleting a submission w/ AFTER handler', (done) => {
      request(app)
        .delete(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission/${createdObjectId}`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.deepEqual({}, JSON.parse(res.text));

          done();
        });
    });

    it('Should update SQLConnector action handler from AFTER to BEFORE', (done) => {
      importedProject.settings = _template.settings
      let actionData = importedProject.actions['customer:sqlconnector']
      actionData.handler = ['before']

      request(app)
        .put(`/${importedProject.name}/form/${importedProject.resources.customer._id}/action/${actionData._id}`)
        .set('x-admin-key', process.env.ADMIN_KEY)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(actionData)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          
          assert.equal(
            actionData.handler[0],
            JSON.parse(res.text).handler[0]
          );
          
          done();
        });
    });

    it('Returns 201 when creating a submission w/ BEFORE handler', (done) => {
      submissionPayload.data.age = 123

      request(app)
        .post(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(submissionPayload)
        .expect(201)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          createdObjectId = JSON.parse(res.text)._id;
          done();
        });
    });

    it('Returns 200 when updating a submission w/ BEFORE handler', (done) => {
      submissionPayload.data.age = 234

      request(app)
        .put(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission/${createdObjectId}`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .send(submissionPayload)
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(
            submissionPayload.data.age,
            JSON.parse(res.text).data.age
          );

          done();
        });
    });

    it('Returns 200 when deleting a submission w/ BEFORE handler', (done) => {
      request(app)
        .delete(`/${importedProject.name}/form/${importedProject.resources.customer._id}/submission/${createdObjectId}`)
        .set('x-token', projectApiKey)
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.deepEqual({}, JSON.parse(res.text));

          done();
        });
    });

  });

  if (!docker)
  describe('x- headers for actions', () => {
    if (docker || customer) {
      return;
    }
    const helper = new template.Helper(template.formio.owner);
    let submissionUrl;
    let administratorRoleActionId;
    let authenticatedRoleActionId;
    let administratorRoleId;
    let authenticatedRoleId;
    let groupId;
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
        .resource('group', [
          {
            input: true,
            label: 'Name',
            key: 'name',
            type: 'textfield',
          },
        ])
        .submission({
          name: 'Test Group',
        })
        .resource('test', [
          {
            input: true,
            label: 'Group',
            key: 'group',
            type: 'textfield',
          },
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
          name: 'role',
          title: 'Authenticated',
          priority: 1,
          method: ['create'],
          handler: ['after'],
          settings: {
            association: 'new',
            type: 'add',
            role: 'authenticated',
          },
        })
        .action({
          name: 'role',
          title: 'Administrator',
          priority: 1,
          method: ['create'],
          handler: ['after'],
          settings: {
            association: 'new',
            type: 'add',
            role: 'administrator',
          },
        })
        .action({
          name: 'group',
          title: 'Group Assignment',
          priority: 5,
          handler: ['after'],
          method: ['create'],
          settings: {
            group: 'group',
          },
        })
        .execute(() => {
          submissionUrl = `/project/${helper.template.project._id}/form/${helper.template.forms.test._id}/submission`;
          administratorRoleActionId = helper.template.actions.test[1]._id;
          authenticatedRoleActionId = helper.template.actions.test[0]._id;
          administratorRoleId = helper.template.roles.administrator._id;
          authenticatedRoleId = helper.template.roles.authenticated._id;
          groupId = helper.template.submissions.group[0]._id;

          done();
        });
    });

    const checkActions = ({
      headers,
      expected: {
        administratorRole,
        authenticatedRole,
        group,
      },
    }, done) => {
      request(app)
        .post(submissionUrl)
        .set('x-token', token)
        .set(headers)
        .send({
          data: {
            group: groupId,
            firstName: 'Joe',
            lastName: 'Smith',
          },
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          const response = res.body;
          assert.equal(response.data.firstName, 'Joe');
          assert.equal(response.data.lastName, 'Smith');
          assert.equal(
            response.roles.includes(administratorRoleId),
            administratorRole,
            administratorRole
              ? 'Should have administrator role assigned'
              : 'Should not have administrator role assigned'
          );
          assert.equal(
            response.roles.includes(authenticatedRoleId),
            authenticatedRole,
            authenticatedRole
              ? 'Should have authenticated role assigned'
              : 'Should not have authenticated role assigned'
          );
          assert.equal(
            response.roles.includes(groupId),
            group,
            group
              ? 'Should have group role assigned'
              : 'Should not have group role assigned'
          );

          done();
        });
    };

    describe('x-actions-include header', () => {
      it('Empty header should not change behavior', (done) => {
        checkActions({
          headers: {
            'x-actions-include': '',
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: true,
          },
        }, done);
      });

      it('Single action might be executed by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'save,group',
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: true,
          },
        }, done);
      });

      it('Multiple actions might be executed by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'save,role',
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: false,
          },
        }, done);
      });

      it('Multiple actions might be executed by action names', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'save,role,group',
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: true,
          },
        }, done);
      });

      it('Incorrect action names ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'save,notexisting',
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: false,
          },
        }, done);
      });

      it('Incorrect action names not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-include': 'save,notexisting,group',
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: true,
          },
        }, done);
      });

      it('Single action might be executed by action Id', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `save,${authenticatedRoleActionId}`,
          },
          expected: {
            administratorRole: false,
            authenticatedRole: true,
            group: false,
          },
        }, done);
      });

      it('Multiple action might be executed by action Ids', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `save,${authenticatedRoleActionId},${administratorRoleActionId}`,
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: false,
          },
        }, done);
      });

      it('Incorrect action Ids ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `save,${incorrectId}`,
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: false,
          },
        }, done);
      });

      it('Incorrect action Ids not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `save,${authenticatedRoleActionId},${incorrectId}`,
          },
          expected: {
            administratorRole: false,
            authenticatedRole: true,
            group: false,
          },
        }, done);
      });

      it('Combination of action names and Ids might be used', (done) => {
        checkActions({
          headers: {
            'x-actions-include': `save,group,${authenticatedRoleActionId}`,
          },
          expected: {
            administratorRole: false,
            authenticatedRole: true,
            group: true,
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
            administratorRole: true,
            authenticatedRole: true,
            group: true,
          },
        }, done);
      });

      it('Single action might be excluded by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'group',
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: false,
          },
        }, done);
      });

      it('Multiple actions might be excluded by action name', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'role',
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: true,
          },
        }, done);
      });

      it('Multiple actions might be excluded by action names', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'role,group',
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: false,
          },
        }, done);
      });

      it('Incorrect action names ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'notexisting',
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: true,
          },
        }, done);
      });

      it('Incorrect action names not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': 'notexisting,group',
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: false,
          },
        }, done);
      });

      it('Single action might be excluded by action Id', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': authenticatedRoleActionId,
          },
          expected: {
            administratorRole: true,
            authenticatedRole: false,
            group: true,
          },
        }, done);
      });

      it('Multiple action might be excluded by action Ids', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': `${authenticatedRoleActionId},${administratorRoleActionId}`,
          },
          expected: {
            administratorRole: false,
            authenticatedRole: false,
            group: true,
          },
        }, done);
      });

      it('Incorrect action Ids ignored', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': incorrectId,
          },
          expected: {
            administratorRole: true,
            authenticatedRole: true,
            group: true,
          },
        }, done);
      });

      it('Incorrect action Ids not blocking other actions', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': `${authenticatedRoleActionId},${incorrectId}`,
          },
          expected: {
            administratorRole: true,
            authenticatedRole: false,
            group: true,
          },
        }, done);
      });

      it('Combination of action names and Ids might be used', (done) => {
        checkActions({
          headers: {
            'x-actions-exclude': `group,${authenticatedRoleActionId}`,
          },
          expected: {
            administratorRole: true,
            authenticatedRole: false,
            group: false,
          },
        }, done);
      });
    });

    it('x-actions-exclude header should be prioritized over x-actions-exclude header', (done) => {
      checkActions({
        headers: {
          'x-actions-include': 'save,role',
          'x-actions-exclude': 'role',
        },
        expected: {
          administratorRole: true,
          authenticatedRole: true,
          group: false,
        },
      }, done);
    });
  });
};
