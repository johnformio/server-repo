/* eslint-env mocha */
'use strict';

var request = require('supertest');
var assert = require('assert');

module.exports = function(app, template, hook) {

  describe('S+C license', function(){

    const resourceTemplate = {
      "display": "form",
      "type": "resource",
      "components": [
          {
              "label": "Text Field",
              "tableView": true,
              "key": "textField",
              "type": "textfield",
              "input": true
          }
      ],
      "access": [],
      "submissionAccess": [],
      "controller": "",
      "properties": {},
      "settings": {},
      "builder": false,
    };

    let id;

    describe('S+C license is not set', function(){
      it('Create recourse', function(done){
        request(app)
        .post(hook.alter('url', '/form', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          ...resourceTemplate,
          title: 'testResource',
          name: 'testResource',
          path: 'testResource'
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          id = res.body._id;
          done();
        });
      });

      it('Should not be able to create recourse with index', function(done){
        request(app)
        .post(hook.alter('url', '/form', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          ...resourceTemplate,
          title: 'testResource1',
          name: 'testResource1',
          path: 'testResource1',
          components: [
            {
              ...resourceTemplate.components,
              dbIndex: true
            }
          ]
        })
        .expect(403)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('Should not be able to create recourse with encrypted', function(done){
        request(app)
        .post(hook.alter('url', '/form', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          ...resourceTemplate,
          title: 'testResource2',
          name: 'testResource2',
          path: 'testResource2',
          components: [
            {
              ...resourceTemplate.components,
              encrypted: true
            }
          ]
        })
        .expect(403)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      });

      it('Should not be able set field to index', function(done){
        request(app)
        .put(hook.alter('url', '/form/' + id + '/', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          components: [
            {
              ...resourceTemplate.components,
              dbIndex: true
            }
          ]
        })
        .expect(403)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      })

      it('Should not be able set field to encrypted', function(done){
        request(app)
        .put(hook.alter('url', '/form/' + id + '/', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          components: [
            {
              ...resourceTemplate.components,
              encrypted: true
            }
          ]
        })
        .expect(403)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      })

      it('Should not be able set submission collection', function(done){
        request(app)
        .put(hook.alter('url', '/form/' + id + '/', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          settings: {collection : 'textField'}
        })
        .expect(403)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          done();
        });
      })
    })

    describe('S+C license is set', function(){

      before(function(done) {
        app.license = {terms : {options : {sac : true}}};
        done();
      });

      it('Should be able to create recourse with index and encrypted field', function(done){
        request(app)
        .post(hook.alter('url', '/form', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          ...resourceTemplate,
          title: 'testResource1',
          name: 'testResource1',
          path: 'testResource1',
          components: [
            {
              ...resourceTemplate.components,
              dbIndex: true,
              encrypted: true
            }
          ]
        })
        .expect('Content-Type', /json/)
        .expect(201)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.body.components[0].dbIndex, true);
          assert.equal(res.body.components[0].encrypted, true);
          id = res.body._id;
          done();
        });
      });

      it('Should be able set submission collection', function(done){
        request(app)
        .put(hook.alter('url', '/form/' + id + '/', template))
        .set('x-jwt-token', template.users.admin.token)
        .send({
          settings: {collection : 'textField'}
        })
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          assert.equal(res.body.settings.collection, 'textField');
          done();
        });
      })
    })

  })
}
