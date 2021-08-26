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
            console.log(res.body);

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
    });

    describe('LDAP Login', () => {
      if (docker || customer) {
        return;
      }
      const helper2 = new template.Helper(template.formio.owner);
      let project2;
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
              "url": "ldap://ldap.forumsys.com:389",
              "bindDn": "cn=read-only-admin,dc=example,dc=com",
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
            assert.equal(res.body._id, 'uid=einstein,dc=example,dc=com');
            assert.equal(res.body.roles.length, 1);
            assert.equal(res.body.roles[0], helper2.template.roles.authenticated._id.toString());
            assert.equal(res.body.data.email, 'einstein@ldap.forumsys.com');
            done();
          });
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
