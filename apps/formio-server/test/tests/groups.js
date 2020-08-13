/* eslint-env mocha */
'use strict';

const _ = require('lodash');
const request = require('supertest');
const assert = require('assert');
const docker = process.env.DOCKER;

module.exports = (app, template, hook) => {
  if (!docker) {
    describe('Groups', () => {
      let helper = new template.Helper(template.formio.owner);
      it('Should create all of the forms and resources needed', (done) => {
        helper
          .project()
          .plan('trial')
          .user('user', 'user1', {
            data: {
              email: 'user1@example.com',
              password: '123testing',
            },
          })
          .user('user', 'user2', {
            data: {
              email: 'user2@example.com',
              password: '123testing',
            },
          })
          .user('user', 'user3', {
            data: {
              email: 'user3@example.com',
              password: '123testing',
            },
          })
          .form({
            name: 'department',
            type: 'resource',
            components: [
              {
                type: 'textfield',
                label: 'Name',
                key: 'name',
                input: true,
              },
            ],
            submissionAccess: [
              {
                type: 'group',
                permission: 'write',
              },
            ],
          })
          .submission('department', {
            data: {
              name: 'HR',
            },
          })
          .submission('department', {
            data: {
              name: 'IT',
            },
          })
          .submission('department', {
            data: {
              name: 'Sales',
            },
          })
          .submission('department', {
            data: {
              name: 'Support',
            },
          })
          .submission('department', {
            data: {
              name: 'QA',
            },
          })
          .submission('department', {
            data: {
              name: 'Marketing',
            },
          })
          .resource('departmentuser', [
            {
              type: 'resource',
              key: 'user',
              resource: 'user',
              input: true,
            },
            {
              type: 'resource',
              key: 'department',
              resource: 'department',
              input: true,
            },
          ])
          .action('departmentuser', {
            data: {
              priority: 5,
              name: 'group',
              title: 'Group Assignment',
              settings: {
                group: 'department',
                user: 'user',
              },
              handler: ['after'],
              method: ['create', 'update', 'delete'],
            },
          })
          .form('departmentreport', [
            {
              type: 'resource',
              key: 'department',
              resource: 'department',
              defaultPermission: 'admin',
              input: true,
            },
            {
              type: 'textarea',
              key: 'notes',
              label: 'Notes',
              input: true,
            },
          ])
          .execute(done);
      });

      it('Should have added the department id to the write permission access', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.deepEqual(
              _.find(res.body.access, {
                type: 'write',
              }),
              {
                type: 'write',
                resources: [helper.template.submissions.department[0]._id.toString()],
              },
            );
            assert(
              !_.find(res.body.access, {
                type: 'admin',
              }),
              'Should not find admin access',
            );
            assert(
              !_.find(res.body.access, {
                type: 'read',
              }),
              'Should not find read access',
            );

            done();
          });
      });

      it('Should assign some users to the departments.', (done) => {
        helper
          .submission('departmentuser', {
            data: {
              user: helper.template.users.user1,
              department: helper.template.submissions.department[0],
            },
          })
          .submission('departmentuser', {
            data: {
              user: helper.template.users.user1,
              department: helper.template.submissions.department[1],
            },
          })
          .submission('departmentuser', {
            data: {
              user: helper.template.users.user2,
              department: helper.template.submissions.department[1],
            },
          })
          .submission('departmentuser', {
            data: {
              user: helper.template.users.user2,
              department: helper.template.submissions.department[2],
            },
          })
          .submission('departmentuser', {
            data: {
              user: helper.template.users.user2,
              department: helper.template.submissions.department[5],
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[0],
              notes: 'This is only for the HR department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[1],
              notes: 'This is only for the IT department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[2],
              notes: 'This is only for the Sales department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[2],
              notes: 'More content for Sales department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[2],
              notes: 'And some more content for Sales department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[1],
              notes: 'More for the IT department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[1],
              notes: 'And some more for the IT department!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[5],
              notes: 'Marketing content!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[5],
              notes: 'More Marketing content!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[5],
              notes: 'And some more Marketing content!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[5],
              notes: 'Yet some more Marketing content!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[5],
              notes: 'Marketing content FTW!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[1],
              notes: 'For IT only!',
            },
          })
          .submission('departmentreport', {
            data: {
              department: helper.template.submissions.department[1],
              notes: 'Here is some more IT content!',
            },
          })
          .execute(done);
      });

      it('Should have added the department roles to the users.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user1._id}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
            assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

            done();
          });
      });

      it('Should have added the department roles to the users.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user2._id}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
            assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

            done();
          });
      });

      it('Should allow a user to read their own department record', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should not allow a user to read other department records', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[2]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should allow a user to update their own department record', (done) => {
        const dept2 = _.cloneDeep(helper.template.submissions.department[1]);
        dept2.data.name = 'IT2';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[1]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .send(dept2)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.name, 'IT2');

            done();
          });
      });

      it('Should let another user update the department record back.', (done) => {
        const dept2 = _.cloneDeep(helper.template.submissions.department[1]);
        dept2.data.name = 'IT';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[1]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .send(dept2)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.name, 'IT');

            done();
          });
      });

      it('Should NOT let another user update a department they dont belong too.', (done) => {
        const dept1 = _.cloneDeep(helper.template.submissions.department[0]);
        dept1.data.name = 'HR2';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .send(dept1)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT let any user delete a department they belong too.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT let any user delete a department they belong too.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[1]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT let any user delete a department they do not belong too.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT let a user elevate permissions', (done) => {
        const dept1 = _.cloneDeep(helper.template.submissions.department[0]);
        const groupPerm = _.find(dept1.access, {
          type: 'write',
        });
        groupPerm.type = 'admin';
        groupPerm.resources.push(helper.template.users.user2._id);
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${helper.template.submissions.department[0]._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .send(dept1)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const writeAccess = _.find(res.body.access, {
              type: 'write',
            });
            assert(Boolean(writeAccess), 'Should have found a write permission');
            assert.deepEqual(writeAccess.resources, [helper.template.submissions.department[0]._id.toString()]);
            assert(
              !_.find(res.body.access, {
                type: 'admin',
              }),
              'Should NOT have found an admin permission',
            );
            assert.equal(res.body.data.name, 'HR');

            done();
          });
      });

      it('Should not let the user update the form.', (done) => {
        const deptForm = _.cloneDeep(helper.template.forms.department);
        deptForm.title = 'Testing';
        request(app)
          .put(`/project/${helper.template.project._id}/department`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .send(deptForm)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should let an admin update the form to change permissions.', (done) => {
        const deptForm = _.cloneDeep(helper.template.forms.department);
        deptForm.submissionAccess = [
          {
            type: 'group',
            permission: 'read',
          },
        ];
        request(app)
          .put(`/project/${helper.template.project._id}/department`)
          .set('x-jwt-token', helper.owner.token)
          .send(deptForm)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            helper.template.forms.department = res.body;
            assert.equal(res.body.submissionAccess[0].type, 'group');
            assert.equal(res.body.submissionAccess[0].permission, 'read');

            done();
          });
      });

      let deptA = null
      it('Should let an admin create a new group', (done) => {
        request(app)
          .post(`/project/${helper.template.project._id}/department/submission`)
          .set('x-jwt-token', helper.owner.token)
          .send({
            data: {
              name: 'Dept A',
            },
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            deptA = res.body;
            const readAccess = _.find(res.body.access, {
              type: 'read',
            });

            assert.deepEqual(readAccess, {
              type: 'read',
              resources: [res.body._id.toString()],
            });
            assert(
              !_.find(res.body.access, {
                type: 'write',
              }),
              'Should not find write access',
            );
            assert(
              !_.find(res.body.access, {
                type: 'admin',
              }),
              'Should not find admin access',
            );

            done();
          });
      });

      it('Should assign some users to the departments.', (done) => {
        request(app)
          .post(`/project/${helper.template.project._id}/departmentuser/submission`)
          .set('x-jwt-token', helper.owner.token)
          .send({
            data: {
              department: deptA,
              user: helper.template.users.user3,
            },
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should have added the deptA id to the user3 roles.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user3._id.toString()}`)
          .set('x-jwt-token', helper.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(deptA._id.toString()), 'Should have the deptA dept role');

            done();
          });
      });

      it('Should allow user3 access to read the deptA department.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user3.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT allow user1 access to read the deptA department.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT allow user2 access to read the deptA department.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT allow user3 access to update the deptA department.', (done) => {
        deptA.data.name = 'deptA2';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user3.token)
          .send(deptA)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            deptA.data.name = 'deptA';

            done();
          });
      });

      it('Should NOT allow user1 access to update the deptA department.', (done) => {
        deptA.data.name = 'deptA2';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .send(deptA)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            deptA.data.name = 'deptA';

            done();
          });
      });

      it('Should NOT allow user3 access to delete the deptA department.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user3.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT allow user1 access to delete the deptA department.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${deptA._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should let an admin update the form to change permissions.', (done) => {
        const deptForm = _.cloneDeep(helper.template.forms.department);
        deptForm.submissionAccess = [
          {
            type: 'group',
            permission: 'admin',
          },
        ];
        request(app)
          .put(`/project/${helper.template.project._id}/department`)
          .set('x-jwt-token', helper.owner.token)
          .send(deptForm)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            helper.template.forms.department = res.body;
            assert.equal(res.body.submissionAccess[0].type, 'group');
            assert.equal(res.body.submissionAccess[0].permission, 'admin');

            done();
          });
      });

      let deptB = null
      it('Should let an admin create a new group', (done) => {
        request(app)
          .post(`/project/${helper.template.project._id}/department/submission`)
          .set('x-jwt-token', helper.owner.token)
          .send({
            data: {
              name: 'Dept B',
            },
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            deptB = res.body;
            const access = _.find(res.body.access, {
              type: 'admin',
            });

            assert.deepEqual(access, {
              type: 'admin',
              resources: [res.body._id.toString()],
            });
            assert(
              !_.find(res.body.access, {
                type: 'read'
              }),
              'Should not find read access',
            );
            assert(
              !_.find(res.body.access, {
                type: 'write'
              }),
              'Should not find write access',
            );

            done();
          });
      });

      it('Should assign some users to the departments.', (done) => {
        request(app)
          .post(`/project/${helper.template.project._id}/departmentuser/submission`)
          .set('x-jwt-token', helper.owner.token)
          .send({
            data: {
              department: deptB,
              user: helper.template.users.user3,
            },
          })
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should have added the deptB id to the user3 roles.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user3._id.toString()}`)
          .set('x-jwt-token', helper.owner.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(deptA._id.toString()), 'Should have the deptA dept role');
            assert(res.body.roles.includes(deptB._id.toString()), 'Should have the deptB dept role');

            done();
          });
      });

      it('Should allow user3 access to read the deptB department.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user3.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT allow user1 access to read the deptB department.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should NOT allow user2 access to read the deptB department.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should allow user3 access to update the deptB department.', (done) => {
        deptB.data.name = 'Dept B1';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user3.token)
          .send(deptB)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.data.name, 'Dept B1');

            done();
          });
      });

      it('Should NOT allow user1 access to update the deptB department.', (done) => {
        deptB.data.name = 'Dept B';
        request(app)
          .put(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .send(deptB)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            deptB.data.name = 'Dept B1';

            done();
          });
      });

      it('Should NOT allow user1 access to delete the deptB department.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect(401)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('Should allow user3 access to delete the deptB department.', (done) => {
        request(app)
          .delete(`/project/${helper.template.project._id}/department/submission/${deptB._id.toString()}`)
          .set('x-jwt-token', helper.template.users.user3.token)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            done();
          });
      });

      it('The department reports should have the correct access configurations.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission/${helper.template.submissions.departmentreport[0]._id}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.access.length, 1);
            assert.equal(res.body.access[0].resources.length, 1);
            assert.equal(res.body.access[0].resources[0], helper.template.submissions.department[0]._id);

            done();
          });
      });

      it('The department reports should have the correct access configurations.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission/${helper.template.submissions.departmentreport[1]._id}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            assert.equal(res.body.access.length, 1);
            assert.equal(res.body.access[0].resources.length, 1);
            assert.equal(res.body.access[0].resources[0], helper.template.submissions.department[1]._id);

            done();
          });
      });

      it('Should allow user1 to see the reports from both departments.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission?sort=-created`)
          .set('x-jwt-token', helper.template.users.user1.token)
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;

            assert.equal(response.length, 6);
            assert.equal(response[0].data.notes, 'Here is some more IT content!');
            assert.equal(response[1].data.notes, 'For IT only!');
            assert.equal(response[2].data.notes, 'And some more for the IT department!');
            assert.equal(response[3].data.notes, 'More for the IT department!');
            assert.equal(response[4].data.notes, 'This is only for the IT department!');
            assert.equal(response[5].data.notes, 'This is only for the HR department!');
            helper.template.users.user1.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user2 to see the reports from their departments.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission?sort=-created`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect('Content-Type', /json/)
          .expect(206)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;

            assert.equal(response.length, 10);
            assert.equal(res.headers['content-range'], '0-9/13');
            assert.equal(response[0].data.notes, 'Here is some more IT content!');
            assert.equal(response[1].data.notes, 'For IT only!');
            assert.equal(response[2].data.notes, 'Marketing content FTW!');
            assert.equal(response[3].data.notes, 'Yet some more Marketing content!');
            assert.equal(response[4].data.notes, 'And some more Marketing content!');
            assert.equal(response[5].data.notes, 'More Marketing content!');
            assert.equal(response[6].data.notes, 'Marketing content!');
            assert.equal(response[7].data.notes, 'And some more for the IT department!');
            assert.equal(response[8].data.notes, 'More for the IT department!');
            assert.equal(response[9].data.notes, 'And some more content for Sales department!');
            helper.template.users.user2.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user2 to see the reports from their departments and skip a few.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission?sort=-created&skip=10`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect('Content-Type', /json/)
          .expect(206)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;

            assert.equal(response.length, 3);
            assert.equal(res.headers['content-range'], '10-12/13');
            assert.equal(response[0].data.notes, 'More content for Sales department!');
            assert.equal(response[1].data.notes, 'This is only for the Sales department!');
            assert.equal(response[2].data.notes, 'This is only for the IT department!');
            helper.template.users.user2.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user2 to see the reports from their departments and limit the results and change sorts.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission?sort=-created&limit=5`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect('Content-Type', /json/)
          .expect(206)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;

            assert.equal(response.length, 5);
            assert.equal(res.headers['content-range'], '0-4/13');
            assert.equal(response[0].data.notes, 'Here is some more IT content!');
            assert.equal(response[1].data.notes, 'For IT only!');
            assert.equal(response[2].data.notes, 'Marketing content FTW!');
            assert.equal(response[3].data.notes, 'Yet some more Marketing content!');
            assert.equal(response[4].data.notes, 'And some more Marketing content!');
            helper.template.users.user2.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user2 to see the reports from their departments and limit the results and change sort and skip.', (done) => {
        request(app)
          .get(`/project/${helper.template.project._id}/departmentreport/submission?sort=-created&limit=5&skip=5`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .expect('Content-Type', /json/)
          .expect(206)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;

            assert.equal(response.length, 5);
            assert.equal(res.headers['content-range'], '5-9/13');
            assert.equal(response[0].data.notes, 'More Marketing content!');
            assert.equal(response[1].data.notes, 'Marketing content!');
            assert.equal(response[2].data.notes, 'And some more for the IT department!');
            assert.equal(response[3].data.notes, 'More for the IT department!');
            assert.equal(response[4].data.notes, 'And some more content for Sales department!');
            helper.template.users.user2.token = res.headers['x-jwt-token'];

            done();
          });
      });

      it('Should allow user2 to use the report API to view submissions within their departments', (done) => {
        request(app)
          .post(`/project/${helper.template.project._id}/report`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .send([
            {
              '$match': {'form': `ObjectId('${helper.template.forms.departmentreport._id}')`},
            },
            {
              '$limit': 10,
            },
            {
              '$sort': {created: -1},
            },
          ])
          .expect(206)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.length, 10);
            assert.equal(res.headers['content-range'], '0-9/13');
            assert.equal(response[0].data.notes, 'Here is some more IT content!');
            assert.equal(response[1].data.notes, 'For IT only!');
            assert.equal(response[2].data.notes, 'Marketing content FTW!');
            assert.equal(response[3].data.notes, 'Yet some more Marketing content!');
            assert.equal(response[4].data.notes, 'And some more Marketing content!');
            assert.equal(response[5].data.notes, 'More Marketing content!');
            assert.equal(response[6].data.notes, 'Marketing content!');
            assert.equal(response[7].data.notes, 'And some more for the IT department!');
            assert.equal(response[8].data.notes, 'More for the IT department!');
            assert.equal(response[9].data.notes, 'And some more content for Sales department!');
            helper.template.users.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });

      it('Should allow user2 to use the report API to view submissions within their departments and change limit, sort, and skip', (done) => {
        request(app)
        .post(`/project/${helper.template.project._id}/report`)
          .set('x-jwt-token', helper.template.users.user2.token)
          .send([
            {
              '$match': {'form': `ObjectId('${helper.template.forms.departmentreport._id}')`},
            },
            {
              '$limit': 5,
            },
            {
              '$skip': 5,
            },
            {
              '$sort': {created: 1},
            },
          ])
          .expect(206)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            const response = res.body;
            assert.equal(response.length, 5);
            assert.equal(res.headers['content-range'], '5-9/13');
            assert.equal(response[0].data.notes, 'And some more for the IT department!');
            assert.equal(response[1].data.notes, 'Marketing content!');
            assert.equal(response[2].data.notes, 'More Marketing content!');
            assert.equal(response[3].data.notes, 'And some more Marketing content!');
            assert.equal(response[4].data.notes, 'Yet some more Marketing content!');
            helper.template.users.user1.token = res.headers['x-jwt-token'];
            done();
          });
      });
    });

    describe('Self assigned user group actions', () => {
      const createHelper = (done, multipleGroups = false) => {
        const helper = new template.Helper(template.formio.owner);
        helper
          .project()
          .plan('trial')
          .form({
            name: 'department',
            type: 'resource',
            components: [
              {
                type: 'textfield',
                label: 'Name',
                key: 'name',
                input: true,
              },
            ],
            submissionAccess: [
              {
                type: 'group',
                permission: 'write',
              },
            ],
          })
          .submission('department', {
            data: {
              name: 'HR',
            },
          })
          .submission('department', {
            data: {
              name: 'IT',
            },
          })
          .form({
            name: 'user2',
            type: 'resource',
            components: [
              {
                type: 'textfield',
                label: 'Username',
                key: 'username',
                input: true,
              },
              {
                type: 'select',
                key: 'department',
                dataSrc: 'resource',
                multiple: multipleGroups,
                data: {
                  resource: helper.template.forms.department,
                },
                input: true,
              },
            ],
          })
          .action('user2', {
            data: {
              priority: 5,
              name: 'group',
              title: 'Group Assignment',
              settings: {
                group: 'department',
                user: '',
              },
              handler: ['after'],
              method: ['create', 'update', 'delete'],
            },
          })
          .execute(() => done(helper));
      };

      const requestUserRoles = (helper, userId, callback) => {
        request(app)
          .get(`/project/${helper.template.project._id}/user2/submission/${userId}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            callback(err, res);
          });
      };

      describe('Single Group', () => {
        let helper;

        it('Should create all of the forms and resources needed', (done) => {
          createHelper((h) => {
            helper = h;
            done();
          });
        });

        it('Should assign user to group', (done) => {
          helper.submission('user2', {
            data: {
              username: 'user1',
              department: helper.template.submissions.department[0],
            },
          }).execute(done);
        });

        it('Should have added the department roles to the user.', (done) => {
          requestUserRoles(helper, helper.template.submissions.user2[0]._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
            assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

            done();
          });
        });

        it('Should have updated the department roles to the user', (done) => {
          helper.submission('user2', {
            _id: helper.template.submissions.user2[0]._id,
            form: helper.template.forms.user2._id,
            data: {
              username: helper.template.submissions.user2[0].username,
              department: helper.template.submissions.department[1],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.submissions.user2[0]._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

              done();
            });
          });
        });
      });

      describe('Multiple Groups', () => {
        let helper;

        it('Should create all of the forms and resources needed', (done) => {
          createHelper((h) => {
            helper = h;
            done();
          }, true);
        });

        it('Should assign user to group', (done) => {
          helper.submission('user2', {
            data: {
              username: 'user1',
              department: [helper.template.submissions.department[0]],
            },
          }).execute(done);
        });

        it('Should have added the department roles to the user.', (done) => {
          requestUserRoles(helper, helper.template.submissions.user2[0]._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
            assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

            done();
          });
        });

        it('Should have updated the department roles to the user', (done) => {
          helper.submission('user2', {
            _id: helper.template.submissions.user2[0]._id,
            form: helper.template.forms.user2._id,
            data: {
              username: helper.template.submissions.user2[0].username,
              department: [helper.template.submissions.department[0], helper.template.submissions.department[1]],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.submissions.user2[0]._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
              assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

              done();
            });
          });
        });

        it('Should have not the department roles to the user', (done) => {
          helper.submission('user2', {
            _id: helper.template.submissions.user2[0]._id,
            form: helper.template.forms.user2._id,
            data: {
              username: helper.template.submissions.user2[0].username,
              department: [],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.submissions.user2[0]._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

              done();
            });
          });
        });
      });
    });

    describe('User Groups actions', () => {
      const createHelper = (done, multipleGroups = false) => {
        const helper = new template.Helper(template.formio.owner);
        helper
          .project()
          .plan('trial')
          .user('user', 'user0', {
            data: {
              email: 'user0@example.com',
              password: '123testing',
            },
          })
          .user('user', 'user1', {
            data: {
              email: 'user1@example.com',
              password: '123testing',
            },
          })
          .form({
            name: 'department',
            type: 'resource',
            components: [
              {
                type: 'textfield',
                label: 'Name',
                key: 'name',
                input: true,
              },
            ],
            submissionAccess: [
              {
                type: 'group',
                permission: 'write',
              },
            ],
          })
          .submission('department', {
            data: {
              name: 'HR',
            },
          })
          .submission('department', {
            data: {
              name: 'IT',
            },
          })
          .resource('departmentuser', [
            {
              type: 'select',
              key: 'user',
              dataSrc: 'resource',
              data: {
                resource: helper.template.forms.user,
              },
              input: true,
            },
            {
              type: 'select',
              key: 'department',
              dataSrc: 'resource',
              multiple: multipleGroups,
              data: {
                resource: helper.template.forms.department,
              },
              input: true,
            },
          ])
          .action('departmentuser', {
            data: {
              priority: 5,
              name: 'group',
              title: 'Group Assignment',
              settings: {
                group: 'department',
                user: 'user',
              },
              handler: ['after'],
              method: ['create', 'update', 'delete'],
            },
          })
          .execute(() => done(helper));
      };

      const requestUserRoles = (helper, userId, callback) => {
        request(app)
          .get(`/project/${helper.template.project._id}/user/submission/${userId}`)
          .set('x-jwt-token', helper.owner.token)
          .end((err, res) => {
            callback(err, res);
          });
      };

      describe('Single Group', () => {
        let helper;

        it('Should create all of the forms and resources needed', (done) => {
          createHelper((h) => {
            helper = h;
            done();
          });
        });

        it('Should assign user to group', (done) => {
          helper.submission('departmentuser', {
            data: {
              user: helper.template.users.user0,
              department: helper.template.submissions.department[0],
            },
          }).execute(done);
        });

        it('Should have added the department roles to the user.', (done) => {
          requestUserRoles(helper, helper.template.users.user0._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
            assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

            done();
          });
        });

        it('Should not have added the department roles to another user.', (done) => {
          requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
            assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

            done();
          });
        });

        it('Should have updated the department roles to the users', (done) => {
          helper.submission('departmentuser', {
            _id: helper.template.submissions.departmentuser[0]._id,
            form: helper.template.forms.departmentuser._id,
            data: {
              user: helper.template.users.user1,
              department: helper.template.submissions.department[0],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.users.user0._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

              requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
                if (err) {
                  return done(err);
                }

                assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
                assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

                done();
              });
            });
          });
        });

        it('Should have updated the department roles to the user', (done) => {
          helper.submission('departmentuser', {
            _id: helper.template.submissions.departmentuser[0]._id,
            form: helper.template.forms.departmentuser._id,
            data: {
              user: helper.template.users.user1,
              department: helper.template.submissions.department[1],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

              done();
            });
          });
        });

        it('Should not have deleted the department roles to the user', (done) => {
          helper.deleteSubmission({
            _id: helper.template.submissions.departmentuser[0]._id,
            form: helper.template.forms.departmentuser._id,
          }, helper.template.owner, (err) => {
            if (err) {
              return done(err);
            }

            requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

              done();
            });
          });
        });
      });

      describe('Multiple Groups', () => {
        let helper;

        it('Should create all of the forms and resources needed', (done) => {
          createHelper((h) => {
            helper = h;
            done();
          }, true);
        });

        it('Should assign user to groups', (done) => {
          helper.submission('departmentuser', {
            data: {
              user: helper.template.users.user0,
              department: [helper.template.submissions.department[0], helper.template.submissions.department[1]],
            },
          }).execute(done);
        });

        it('Should have added the department roles to the user.', (done) => {
          requestUserRoles(helper, helper.template.users.user0._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
            assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

            done();
          });
        });

        it('Should not have added the department roles to another user.', (done) => {
          requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
            assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

            done();
          });
        });

        it('Should have updated the department roles to the users', (done) => {
          helper.submission('departmentuser', {
            _id: helper.template.submissions.departmentuser[0]._id,
            form: helper.template.forms.departmentuser._id,
            data: {
              user: helper.template.users.user1,
              department: [helper.template.submissions.department[0], helper.template.submissions.department[1]],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.users.user0._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

              requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
                if (err) {
                  return done(err);
                }

                assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
                assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

                done();
              });
            });
          });
        });

        it('Should have added the department roles to the user.', (done) => {
          requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
            if (err) {
              return done(err);
            }

            assert(res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must have the department id as a role.');
            assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

            done();
          });
        });

        it('Should have updated the department roles to the user', (done) => {
          helper.submission('departmentuser', {
            _id: helper.template.submissions.departmentuser[0]._id,
            form: helper.template.forms.departmentuser._id,
            data: {
              user: helper.template.users.user1,
              department: [helper.template.submissions.department[1]],
            },
          }).execute(() => {
            requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must have the department id as a role.');

              done();
            });
          });
        });

        it('Should not have deleted the department roles to the user', (done) => {
          helper.deleteSubmission({
            _id: helper.template.submissions.departmentuser[0]._id,
            form: helper.template.forms.departmentuser._id,
          }, helper.template.owner, (err) => {
            if (err) {
              return done(err);
            }

            requestUserRoles(helper, helper.template.users.user1._id, (err, res) => {
              if (err) {
                return done(err);
              }

              assert(!res.body.roles.includes(helper.template.submissions.department[0]._id.toString()), 'Must not have the department id as a role.');
              assert(!res.body.roles.includes(helper.template.submissions.department[1]._id.toString()), 'Must not have the department id as a role.');

              done();
            });
          });
        });
      });
    });
  }
};
