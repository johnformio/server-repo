/* eslint-env mocha */
'use strict';

const request = require('supertest');
const assert = require('assert');

const reportingUITemplate = require('@formio/reporting/reportConfigTemplate.json');

module.exports = function(app, template, hook) {
  let form;
  describe('Reporting Configurator', () => {
    before('Ensure the project has the reporting UI configurator', (done) => {
      request(app)
        .post('/project/' + template.project._id + '/form')
        .set('x-jwt-token', template.users.admin.token)
        .send({
          ...reportingUITemplate,
          "name": "reportingui",
          "path": "reportingui",
          "title": "Reporting UI Configurator",
        })
        .expect(201)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          done();
        });
    });
    before('Create a form for reporting', (done) => {
      request(app)
        .post('/project/' + template.project._id + '/form')
        .set('x-jwt-token', template.users.admin.token)
        .send({
          "type": "form",
          "name": "reporting",
          "title": "Reporting",
          "path": "reporting",
          "components": [
            {
              "type": "textfield",
              "key": "a",
              "label": "A",
              "input": true,
            },
            {
              "type": "textfield",
              "key": "b",
              "label": "B",
              "input": true,
            }
          ]
        })
        .expect(201)
        .end((err, res) => {
      if (err) {
            return done(err);
          }
          form = res.body;
          done();
        });
    })
    it('Should allow a submission to the reporting UI configurator form', (done) => {
      request(app)
        .post(`/${template.project.name}/reportingui/submission`)
        .set('x-jwt-token', template.users.admin.token)
        .send({
          "data": {
              "title": "Test Report",
              "name": "testReport",
              "gridSettings": {
                  "itemsPerPage": 10,
                  "allowCaching": true,
                  "cellMaxWidth": ""
              },
              "forms": [
                  form._id,
              ],
              "calculatedColumns": [
                  {
                      "name": "Test Column",
                      "key": "testColumn",
                      "operator": "concat",
                      "concatArgs": [
                          {
                              "field": {
                                  "path": "a",
                                  "formId": form._id
                              },
                              "connector": ""
                          }
                      ]
                  }
              ],
              "groups": {
                  "groupingFields": [
                      {
                          "field": {
                              "path": "a",
                              "formId": form._id,
                          }
                      }
                  ],
                  "calculatedColumns": [
                      {
                          "name": "Test Column",
                          "key": "testColumn",
                          "operator": "avg",
                          "argument": {
                              "path": "testColumn"
                          }
                      }
                  ]
              },
              "columnsList": [
                  {
                      "value": {
                          "path": "a",
                          "formId": form._id,
                      },
                      "label": "A (Reporting/a)"
                  },
                  {
                      "value": {
                          "path": "testColumn"
                      },
                      "label": "Test Column (*calculated)"
                  }
              ],
              "reportType": {
                  "grouping": true,
                  "typeChanged": false
              },
              "enableControls": false,
              "reportingForms": [
                  form
              ],
              "availableColumns": [
                  {
                      "column": {
                          "path": "a",
                          "formId": form._id
                      },
                      "displayTitle": ""
                  }
              ],
              "defaultColumns": [
                  {
                      "path": "a",
                      "formId": form._id
                  }
              ]
          },
          "metadata": {
              "selectData": {
                  "gridSettings": {
                      "itemsPerPage": {
                          "label": "10"
                      }
                  },
                  "forms": {
                      [form._id]: {
                          "title": "Reporting"
                      }
                  },
                  "calculatedColumns": [
                      {
                          "operator": {
                              "label": "Concatenate Strings"
                          }
                      }
                  ],
                  "groups": {
                      "calculatedColumns": [
                          {
                              "operator": {
                                  "label": "Average"
                              }
                          }
                      ]
                  }
              },
              "timezone": "America/Chicago",
              "offset": -300,
              "origin": "http://localhost:3000",
              "referrer": "",
              "browserName": "Netscape",
              "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
              "pathName": "/",
              "onLine": true
          },
          "state": "submitted",
          "_vnote": ""
        })
        .expect(201)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          done();
        });
    })
  });

  describe('Aggregation Reporting', function () {
    it('Should not allow aggregation for anonymous users.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .expect(401)
        .end(done);
    });

    var count = 0;
    it('Should allow aggregation for users with permission', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          count = res.body.length;
          done();
        });
    });

    it('Should allow $lookup in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$lookup': {
            from: 'submissions',
            localField: 'data.email',
            foreignField: 'data.email',
            as: 'email'
          }
        }]))
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should allow $project not only with integers in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$project': {
            "_id": 0,
            form: 1,
            owner: 'test'
          }
        }]))
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should allow $project with integers in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$project': {
            "_id": 0,
            form: 1,
            owner: 1
          }
        }]))
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should not allow $redact in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$redact': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $sample in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$sample': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $geoNear in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$geoNear': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $out in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$out': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should not allow $indexStats in aggregation.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$indexStats': {}
        }]))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          assert(res.text, 'Disallowed stage used in aggregation.');
          done();
        });
    });

    it('Should allow $lookup in aggregation after other stages.', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([
          {'$match': {}},
          {'$lookup': {
            from: 'submissions',
            localField: 'data.email',
            foreignField: 'data.email',
            as: 'email',
          }}
        ]))
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
    });

    it('Should allow $limit in aggregation.', function(done) {
      count = (count > 0) ? (count - 1) : 1;
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$limit': count
        }]))
        .expect(206)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body.length, count);
          done();
        });
    });

    it('Should allow $addFields in aggregation.', function(done) {
      count = (count > 0) ? (count - 1) : 1;
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$addFields': {test: 123}
        }]))
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          assert.equal(res.body[0].test, 123);
          done();
        });
    });

    it('Should allow ObjectId in aggregation (single quotes).', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'form': `ObjectId('${template.resources.user._id}')`
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow ObjectId in aggregation (double quotes).', function(done) {
      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'form': `ObjectId("${template.resources.user._id}")`
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (plain time input).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date(${yesterday})`,
              '$lte': `Date(${now})`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (time input w/ single quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date('${yesterday}')`,
              '$lte': `Date('${now}')`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (time input w/ double quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date("${yesterday}")`,
              '$lte': `Date("${now}")`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (plain date string input).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date(${yesterday.toString()})`,
              '$lte': `Date(${now.toString()})`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (date string input w/ single quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date('${yesterday.toString()}')`,
              '$lte': `Date('${now.toString()}')`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });

    it('Should allow Date in aggregation (date input w/ double quotes).', function(done) {
      let now = (new Date()).getTime();
      let yesterday = now - 1000 * 60 * 60 * 24;

      request(app)
        .get('/project/' + template.project._id + '/report')
        .set('x-jwt-token', template.users.admin.token)
        .set('x-query', JSON.stringify([{
          '$match': {
            'created': {
              '$gte': `Date("${yesterday.toString()}")`,
              '$lte': `Date("${now.toString()}")`
            }
          }
        }]))
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }

          assert(res.body.length > 0);
          done();
        });
    });
  });
};
