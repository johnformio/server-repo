'use strict';

const assert = require('assert');
const moment = require('moment');
const request = require('supertest');
const chance = new (require('chance'))();
const config = require('../../config');

module.exports = (app, template, hook) => {
  if (!config.formio.hosted) {
    return;
  }
  describe('UsageTracking integration tests', () => {
    let testProject = {
      title: "Usage Test Project",
      name: "usageTestProject",
      type: "project",
      plan: "commercial",
    };
    let testForm = {
      title: chance.word(),
      path: chance.word(),
      name: chance.word(),
      type: 'form',
      components: [{
        type: 'textField',
        input: true,
        key: 'player'
      }]
    }
    const usageTracking = app.formio.usageTracking;
    const pdfProjectApiKey = 'testPdfProjectApiKey';
    const pdfProjectReq = {
      title: "Test PDF Project",
      type: "project",
      plan: "commercial",
      settings: {
        keys: [
          {
            name: 'testApiKey',
            key: pdfProjectApiKey
          }
        ]
      }
    }
    const pdfProjectForms = require('./fixtures/pdfProjectForms.json');

    before('Set up test PDF project', async () => {
      let {body: pdfProject} = await request(app)
        .post('/project')
        .query({skipPdfInfo: true})
        .set('x-jwt-token', template.formio.owner.token)
        .send(pdfProjectReq)
        .expect(201);

      await request(app)
        .post(`/${pdfProject.name}/form`)
        .set('x-token', pdfProjectApiKey)
        .send(pdfProjectForms.pdf)
        .expect(201);
      await request(app)
        .post(`/${pdfProject.name}/form`)
        .set('x-token', pdfProjectApiKey)
        .send(pdfProjectForms.info)
        .expect(201);
      await request(app)
        .post(`/${pdfProject.name}/form`)
        .set('x-token', pdfProjectApiKey)
        .send(pdfProjectForms.purchase)
        .expect(201);

      config.pdfProject = `${config.host}:${config.port}/${pdfProject.name}`;
      config.pdfProjectApiKey = pdfProjectApiKey;
    });

    before('Create the test project and a test form', (done) => {
      request(app)
        .post('/project')
        .set('x-jwt-token', template.formio.owner.token)
        .send(testProject)
        .expect(201)
        .then((response) => {
          testProject = response.body;
          assert(usageTracking != undefined, 'Formio object should have a usageTracking parameter');
          return request(app)
            .post(`/project/${testProject._id}/form`)
            .set('x-jwt-token', template.formio.owner.token)
            .send(testForm)
            .expect(201);
        }).then((response) => {
          testForm = response.body;
          done();
        })
        .catch(done);
    });

    it('A new project should have fresh billing metrics in the usage cache', (done) => {
      const usageMetrics = usageTracking._cache.get(testProject._id);
      assert.equal(usageMetrics.submissionRequests, 0);
      assert.equal(usageMetrics.pdfDownloads, 0);
      assert.equal(usageMetrics.formRequests, 0);
      assert.equal(usageMetrics.emails, 0);
      done();
    });

    it('The database will accurately reflect formRequests', (done) => {
      let promises = [];
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .get(`/project/${testProject._id}/form/${testForm._id}`)
          .set('x-jwt-token', template.formio.owner.token)
          .expect(200);
        promises.push(promise);
      }
      Promise.all(promises).then((responses) => {
        assert.equal(responses.length, 5);
        const queryStart = moment.utc().startOf('month').toDate();
        const queryEnd = moment.utc().endOf('month').toDate();
        return usageTracking._aggregateFromDbAndSetCache(testProject._id, queryStart, queryEnd);
      }).then(({formRequests}) => {
        assert.equal(formRequests, 5);
        done();
      }).catch(done);
    });

    it('The database will accurately store submissionRequests', (done) => {
      let promises = [];
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .post(`/project/${testProject._id}/form/${testForm._id}/submission`)
          .set('x-jwt-token', template.formio.owner.token)
          .send({
            data: {
              player: chance.name()
            }
          })
          .expect(201);
        promises.push(promise);
      }
      Promise.all(promises).then((responses) => {
        assert.equal(responses.length, 5);
        const queryStart = moment.utc().startOf('month').toDate();
        const queryEnd = moment.utc().endOf('month').toDate();
        return usageTracking._aggregateFromDbAndSetCache(testProject._id, queryStart, queryEnd);
      }).then(({submissionRequests}) => {
        assert.equal(submissionRequests, 5);
        done();
      }).catch(done);
    });
  });
}
