'use strict';

const {Formio} = require('formiojs');
const assert = require('assert');
const request = require('supertest');

module.exports = (app, template, hook) => {
  const helper = new template.Helper(template.formio.owner);
  let validateUrl;

  describe('Validate Endpoint', () => {
    it('Creates a test project and form', done => {
      helper
        .project()
        .plan('trial')
        .form('submissionValidate', [
          {
            input: true,
            label: 'First Name',
            key: 'firstName',
            validate: {
              required: true,
            },
            type: 'textfield',
          },
          {
            input: true,
            label: 'Last Name',
            key: 'lastName',
            validate: {
              required: true,
            },
            type: 'textfield',
          },
        ])
        .execute(() => {
          validateUrl = `/project/${helper.template.project._id}/form/${helper.template.forms.submissionValidate._id}/validate`;
          done();
        });
    });

    it('Should keep the same permissions as submission endpoint', (done) => {
      request(app)
        .post(validateUrl)
        .send({
          data: {
            firstName: 'Joe',
            lastName: 'Smith',
          },
        })
        .expect(401)
        .end(done);
    });

    it('Should validate a submission', (done) => {
      request(app)
        .post(validateUrl)
        .set('x-jwt-token', helper.owner.token)
        .send({
          data: {
            firstName: 'Joe',
            lastName: 'Smith',
          },
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.data.firstName, 'Joe');
          assert.equal(res.body.data.lastName, 'Smith');

          done();
        });
    });

    it('Should return validation erros if submission data is not valid', (done) => {
      request(app)
        .post(validateUrl)
        .set('x-jwt-token', helper.owner.token)
        .send({
          data: {
            firstName: 'Joe',
          },
        })
        .expect('Content-Type', /json/)
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.name, 'ValidationError');

          done();
        });
    });
  });

  describe('Custom validation for non-standart component type', () => {
    it('Creates a form containing custom component', done => {
      helper
        .project()
        .plan('trial')
        .form('nonStandartComponentValidate', [
          {
            input: true,
            key: "testComponent",
            tableView: false,
            label: "TestComponent",
            type: "testcomponent",
            validate: {
              custom: "valid = value !== 'blob'"
            }
          },
        ])
        .execute(() => {
          validateUrl = `/project/${helper.template.project._id}/form/${helper.template.forms.nonStandartComponentValidate._id}/submission`;
          done();
        });
    });
    it('Should return validation error', (done) => {
      request(app)
        .post(validateUrl)
        .set('x-jwt-token', helper.owner.token)
        .send({
          data: {
            testComponent: 'blob'
          }
        })
        .expect('Content-Type', /json/)
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          done();
        });
    });
  });
};
