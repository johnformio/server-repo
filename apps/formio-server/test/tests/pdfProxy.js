/* eslint-env mocha */
'use strict';

const nock = require('nock');
const request = require('supertest');
const assert = require('assert');
const sinon = require('sinon');
const downloadPDF = require('../../src/util/downloadPDF');
const formioProject = require('../../formio.json');
var chance = new (require('chance'))();

module.exports = function(app, template, hook) {
  describe('PDF Proxy tests', () => {
    const pdfServer = 'http://localhost:4005';

    const projectId = template.formio.project._id;
    const projectName = template.formio.project.name;

    const formId = template.formio.userResource._id;
    const formName = template.formio.userResource.name;

    const submissionId = template.formio.owner._id;

    const pdfFile = Buffer.from('some test dummy pdf data');
    const fileId = '123';

    before(() => {
      nock(pdfServer)
        .persist()

        .get(`/pdf/${projectId}/file/${fileId}`)
        .reply(200, pdfFile, {'Content-Type': 'application/pdf', 'Content-Length': pdfFile.length})

        .post(`/pdf/${projectId}/file/pdf/download`, (body) => body.form && body.submission)
        .query((qs) => qs.format && qs.project)
        .reply(200, pdfFile, {'Content-Type': 'application/pdf', 'Content-Length': pdfFile.length})

        .post(`/pdf/${projectId}/download`, (body) => body.form && body.submission)
        .query((qs) => qs.format && qs.project)
        .reply(200, pdfFile, {'Content-Type': 'application/pdf', 'Content-Length': pdfFile.length})

        .post(`/pdf/${projectId}/file`, )
        .reply(
          200,
          JSON.stringify({path: "somepath", file: "somepath", formfields: {}}),
          {'Content-Type': 'application/json'}
        );
    });


    before('Create the test project for checking permissions', (done) => {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send({
          title: 'Usual',
          name: 'usual',
          plan: 'commercial',
          template: formioProject,
          type: 'project'
        })
        .expect(201)
        .then((res) => {
          template.usualProject = {
            primary: res.body,
            project: res.body,
            owner: {
              data: {
                name: chance.word(),
                email: 'mike@form.io',
                password: chance.word({ length: 8 })
              }
            }
          };
          const event = template.hooks.getEmitter();
          event.once('newMail', (email) => {
            const regex = /(?<=token=)[^"]+/i;
            let token = email.html.match(regex);
            token = token ? token[0] : token;
            template.usualProject.owner.token = token;
            done();
          });

          return request(app).get('/project/' + template.usualProject.project._id + '/form?limit=9999999')
        })
        .then((res) => {
            const response = res.body;
            response.forEach(function (form) {
              if (form.name === 'userRegistrationForm') {
                template.usualProject.formRegister = form;
              }
            });
          return request(app)
            .post('/project/' + template.usualProject.project._id + '/form/' + template.usualProject.formRegister._id + '/submission')
            .send({
              data: {
                'name': template.usualProject.owner.data.name,
                'email': template.usualProject.owner.data.email,
              }
            }).then((res) => {
              const response = res.body;
              assert(response.hasOwnProperty('_id'), 'The response should contain an `_id`.');
            })
        }).catch(done);
    });

    after('Remove unused projects', (done) => {
      delete template.usualProject;
      done();
    })

    it('Will not error out if there is no projectId', (done) => {
      request(app)
        .get('/pdf-proxy/pdf/thisProjectDoesNotExist')
        .set('x-jwt-token', template.formio.owner.token)
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.message === 'No project found.');
          done();
        });
    });

    it('Shouldn`t allowed to delete PDF for a user without permissions', (done) => {
      request(app)
        .delete(`/pdf-proxy/pdf/${template.usualProject.project._id}/file/${fileId}`)
        .set('x-jwt-token', template.usualProject.owner.token)
        .expect(401)
        .end(done);
    });

    it('Should proxy file fetch', (done) => {
      request(app)
        .get(`/pdf-proxy/pdf/${projectId}/file/${fileId}`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy PDF download', (done) => {
      request(app)
        .get(`/project/${projectId}/form/${formId}/submission/${submissionId}/download`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should return error when formId URL parameter is undefined', done => {
      request(app)
        .get(`/project/${projectId}/form/undefined/submission/${submissionId}/download`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect('Content-Type', /text/)
        .expect(400)
        .end(done);
    });

    it('Should return error when formId URL parameter is null', done => {
      request(app)
        .get(`/project/${projectId}/form/null/submission/${submissionId}/download`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect('Content-Type', /text/)
        .expect(400)
        .end(done);
    });

    it('Should proxy PDF download with project alias', (done) => {
      request(app)
        .get(`/${projectName}/form/${formId}/submission/${submissionId}/download`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy PDF download with form alias', (done) => {
      request(app)
        .get(`/project/${projectId}/${formName}/submission/${submissionId}/download`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy submission changelog download', (done) => {
      request(app)
        .get(`/project/${projectId}/form/${formId}/submission/${submissionId}/download/changelog`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy submission changelog download with project alias', (done) => {
      request(app)
        .get(`/${projectName}/form/${formId}/submission/${submissionId}/download/changelog`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy submission changelog download with form alias', (done) => {
      request(app)
        .get(`/project/${projectId}/${formName}/submission/${submissionId}/download/changelog`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy PDF upload', (done) => {
      request(app)
        .post(`/project/${projectId}/upload`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .attach('file', pdfFile, 'file.pdf')
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.hasOwnProperty('path'));
          assert(res.body.hasOwnProperty('file'));
          assert(res.body.hasOwnProperty('formfields'));
          done();
        });
    });

    it('Should proxy PDF upload with project alias', (done) => {
      request(app)
        .post(`/${projectName}/upload`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.hasOwnProperty('path'));
          assert(res.body.hasOwnProperty('file'));
          assert(res.body.hasOwnProperty('formfields'));
          done();
        });
    });

    it('Should proxy file fetch with subdomain project alias', (done) => {
      request(app)
        .get(`/pdf-proxy/pdf/${projectId}/file/${fileId}`)
        .set('Host', `${projectName}.test.form.io`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy PDF upload with subdomain project alias', (done) => {
      request(app)
        .post(`/upload`)
        .set('Host', `${projectName}.test.form.io`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .attach('file', pdfFile, 'file.pdf')
        .expect(200)
        .expect('Content-Type', 'application/json; charset=utf-8')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.hasOwnProperty('path'));
          assert(res.body.hasOwnProperty('file'));
          assert(res.body.hasOwnProperty('formfields'));
          done();
        });
    });

    it('Should proxy PDF download with subdomain project alias', (done) => {
      request(app)
        .get(`/form/${formId}/submission/${submissionId}/download`)
        .set('Host', `${projectName}.test.form.io`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          assert(res.body.equals(pdfFile));
          done();
        });
    });

    it('Should proxy submission changelog download with subdomain project alias', (done) => {
      request(app)
        .get(`/form/${formId}/submission/${submissionId}/download/changelog`)
        .set('Host', `${projectName}.test.form.io`)
        .set(`x-jwt-token`, template.formio.owner.token)
        .expect(200)
        .expect('Content-Type', 'application/pdf')
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.equals(pdfFile));
          done();
        });
    });

    describe('PDF Request Header Construction', () => {
      const req = {
        headers: {
          host: 'http://localhost:3000'
        },
        query: {},
        params: {
          projectId
        }
      };
      const project = {
        _id: projectId,
        title: "Dummy Project",
        name: "dummyProject",
        type: "project",
        config: {},
        settings: {
          cors: "*",
          appOrigin: "http://localhost:3000",
        },
      };
      const form = {
        _id: formId,
        title: "Dummy Form",
        name: "dummyForm",
        path: "dummyform",
        type: "form",
        components: [
          {
            label: "Text Field",
            applyMaskOn: "change",
            tableView: true,
            key: "textField",
            type: "textfield",
            input: true,
          },
        ],
      };
      const submission = {
        _id: submissionId,
        data: {
          textField: "Hello, world!"
        }
      };

      it('Should strip the host header when making the request to the PDF server when downloadPDF is called directly', (done) => {
        const downloadPDFFn = downloadPDF(app.formio);
        downloadPDFFn(req, project, form, submission)
          .then(() => {
            assert(!!req.headers.host === false);
            done();
          })
          .catch(done)
      });
    });
  });
};
