/* eslint-env mocha */
'use strict';
const request = require('supertest');
const assert = require('assert');

module.exports = function(app, template, hook) {
  describe('Groups', () => {
    let helper = new template.Helper(template.formio.owner);
    it('Should create all of the forms and resources needed', (done) => {
      helper
        .project()
        .plan('trial')
        .user('user', 'user1', {
          data: {
            email: 'user1@example.com',
            password: '123testing'
          }
        })
        .user('user', 'user2', {
          data: {
            email: 'user2@example.com',
            password: '123testing'
          }
        })
        .resource('department', [
          {
            type: 'textfield',
            label: 'Name',
            key: 'name'
          }
        ])
        .submission('department', {
          data: {
            name: 'HR'
          }
        })
        .submission('department', {
          data: {
            name: 'IT'
          }
        })
        .submission('department', {
          data: {
            name: 'Sales'
          }
        })
        .submission('department', {
          data: {
            name: 'Support'
          }
        })
        .submission('department', {
          data: {
            name: 'QA'
          }
        })
        .submission('department', {
          data: {
            name: 'Marketing'
          }
        })
        .resource('departmentuser', [
          {
            type: 'resource',
            key: 'user',
            resource: 'user'
          },
          {
            type: 'resource',
            key: 'department',
            resource: 'department'
          }
        ])
        .action('departmentuser', {
          data: {
            priority: 5,
            name: 'group',
            title: 'Group Assignment',
            settings: {
              group: 'department',
              user: 'user'
            },
            handler: ['after'],
            method: ['create'],
            condition: {},
            submit: true
          },
          state: 'submitted'
        })
        .form('departmentreport', [
          {
            type: 'resource',
            key: 'department',
            resource: 'department',
            defaultPermission: 'admin'
          },
          {
            type: 'textarea',
            key: 'notes',
            label: 'Notes'
          }
        ])
        .execute(function() {
          done();
        });
    });

    it('Should assign some users to the departments.', (done) => {
      helper
        .submission('departmentuser', {
          data: {
            user: helper.template.users.user1,
            department: helper.template.submissions.department[0]
          }
        })
        .submission('departmentuser', {
          data: {
            user: helper.template.users.user1,
            department: helper.template.submissions.department[1]
          }
        })
        .submission('departmentuser', {
          data: {
            user: helper.template.users.user2,
            department: helper.template.submissions.department[1]
          }
        })
        .submission('departmentuser', {
          data: {
            user: helper.template.users.user2,
            department: helper.template.submissions.department[2]
          }
        })
        .submission('departmentuser', {
          data: {
            user: helper.template.users.user2,
            department: helper.template.submissions.department[5]
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[0],
            notes: 'This is only for the HR department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[1],
            notes: 'This is only for the IT department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[2],
            notes: 'This is only for the Sales department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[2],
            notes: 'More content for Sales department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[2],
            notes: 'And some more content for Sales department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[1],
            notes: 'More for the IT department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[1],
            notes: 'And some more for the IT department!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[5],
            notes: 'Marketing content!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[5],
            notes: 'More Marketing content!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[5],
            notes: 'And some more Marketing content!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[5],
            notes: 'Yet some more Marketing content!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[5],
            notes: 'Marketing content FTW!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[1],
            notes: 'For IT only!'
          }
        })
        .submission('departmentreport', {
          data: {
            department: helper.template.submissions.department[1],
            notes: 'Here is some more IT content!'
          }
        })
        .execute(() => {
          done();
        });
    });

    it('Should have added the department roles to the users.', (done) => {
      request(app)
        .get(`/project/${helper.template.project._id}/user/submission/${helper.template.users.user1._id}`)
        .set('x-jwt-token', helper.owner.token)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.roles.indexOf(helper.template.submissions.department[0]._id.toString()) !== -1, 'Must have the department id as a role.');
          assert(res.body.roles.indexOf(helper.template.submissions.department[1]._id.toString()) !== -1, 'Must have the department id as a role.');
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
          assert(res.body.roles.indexOf(helper.template.submissions.department[0]._id.toString()) === -1, 'Must have the department id as a role.');
          assert(res.body.roles.indexOf(helper.template.submissions.department[1]._id.toString()) !== -1, 'Must not have the department id as a role.');
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
        .get('/project/' + helper.template.project._id + '/departmentreport/submission?sort=-created')
        .set('x-jwt-token', helper.template.users.user1.token)
        .expect('Content-Type', /json/)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
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
        .get('/project/' + helper.template.project._id + '/departmentreport/submission?sort=-created')
        .set('x-jwt-token', helper.template.users.user2.token)
        .expect('Content-Type', /json/)
        .expect(206)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
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

    it('Should allow user2 to see the reports from their departments and skip a few.', (done) => {
      request(app)
        .get('/project/' + helper.template.project._id + '/departmentreport/submission?sort=-created&skip=10')
        .set('x-jwt-token', helper.template.users.user2.token)
        .expect('Content-Type', /json/)
        .expect(206)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.length, 3);
          assert.equal(res.headers['content-range'], '10-12/13');
          assert.equal(response[0].data.notes, 'More content for Sales department!');
          assert.equal(response[1].data.notes, 'This is only for the Sales department!');
          assert.equal(response[2].data.notes, 'This is only for the IT department!');
          helper.template.users.user1.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Should allow user2 to see the reports from their departments and limit the results and change sorts.', (done) => {
      request(app)
        .get('/project/' + helper.template.project._id + '/departmentreport/submission?sort=created&limit=5')
        .set('x-jwt-token', helper.template.users.user2.token)
        .expect('Content-Type', /json/)
        .expect(206)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
          assert.equal(response.length, 5);
          assert.equal(res.headers['content-range'], '0-4/13');
          assert.equal(response[0].data.notes, 'This is only for the IT department!');
          assert.equal(response[1].data.notes, 'This is only for the Sales department!');
          assert.equal(response[2].data.notes, 'More content for Sales department!');
          assert.equal(response[3].data.notes, 'And some more content for Sales department!');
          assert.equal(response[4].data.notes, 'More for the IT department!');
          helper.template.users.user1.token = res.headers['x-jwt-token'];
          done();
        });
    });

    it('Should allow user2 to see the reports from their departments and limit the results and change sort and skip.', (done) => {
      request(app)
        .get('/project/' + helper.template.project._id + '/departmentreport/submission?sort=created&limit=5&skip=5')
        .set('x-jwt-token', helper.template.users.user2.token)
        .expect('Content-Type', /json/)
        .expect(206)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }

          var response = res.body;
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

    it('Should allow user2 to use the report API to view submissions within their departments', (done) => {
      request(app)
        .post('/project/' + helper.template.project._id + '/report')
        .set('x-jwt-token', helper.template.users.user2.token)
        .send([
          {
            '$match': {'form': `ObjectId('${helper.template.forms.departmentreport._id}')`},
          },
          {
            '$limit': 10
          },
          {
            '$sort': {created: -1}
          }
        ])
        .expect(206)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          var response = res.body;
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
        .post('/project/' + helper.template.project._id + '/report')
        .set('x-jwt-token', helper.template.users.user2.token)
        .send([
          {
            '$match': {'form': `ObjectId('${helper.template.forms.departmentreport._id}')`},
          },
          {
            '$limit': 5
          },
          {
            '$skip': 5
          },
          {
            '$sort': {created: 1}
          }
        ])
        .expect(206)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          var response = res.body;
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
};
