/* eslint-env mocha */
"use strict";

const request = require("supertest");
const assert = require("assert");
const license = require("../../src/util/license");
const config = require("../../config");
const getSubmissionModel = require("../../src/util/util").getSubmissionModel;

module.exports = function (app, template, hook) {
  describe("S+C license", function () {
    const projectTemplate = {
      title: "S+C Test Project",
      name: "sacTestProject",
      type: "project",
      plan: "commercial",
      formDefaults: null,
      settings: {
      },
    };
    const resourceTemplate = {
      display: "form",
      type: "resource",
      components: [
        {
          label: "Text Field",
          tableView: true,
          key: "textField",
          type: "textfield",
          input: true,
        },
      ],
      access: [],
      submissionAccess: [],
      controller: "",
      properties: {},
      settings: {},
      builder: false,
    };

    let resourceId, project, form;

    describe("S+C license is not set", function () {
      before(() => {
        process.env.ADMIN_KEY = "examplekey";
        process.env.TEST_SIMULATE_SAC_PACKAGE = false;
      });

      it("Should create the project from template", (done) => {
        request(app)
          .post("/project")
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send(projectTemplate)
          .expect(201)
          .expect("Content-Type", /json/)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert(
              res.body.hasOwnProperty("access"),
              "Created project should have access property"
            );
            assert(
              res.body.hasOwnProperty("created"),
              "Created project should have created at property"
            );
            assert(
              res.body.hasOwnProperty("type"),
              "Created project should have type property"
            );
            assert.equal(res.body.type, "project");
            project = res.body;

            done();
          });
      });

      it("Create resource", function (done) {
        request(app)
          .post(`/project/${project._id}/form`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            ...resourceTemplate,
            title: "testResource",
            name: "testResource",
            path: "testResource",
          })
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            resourceId = res.body._id;
            done();
          });
      });

      it("Should not be able to create a new resource with component that creates an index", function (done) {
        request(app)
          .post(`/project/${project._id}/form`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            ...resourceTemplate,
            title: "testResource1",
            name: "testResource1",
            path: "testResource1",
            components: resourceTemplate.components.map((component) => ({
              ...component,
              dbIndex: true,
            })),
          })
          .expect(403)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(res.status, 403);
            assert.equal(
              res.text,
              `Cannot create index at path "textField", the Security & Compliance package is required to create database indexes`
            );
            done();
          });
      });

      it("Should not be able to create a new resource with an encrypted field", function (done) {
        request(app)
          .post(`/project/${project._id}/form`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            ...resourceTemplate,
            title: "testResource2",
            name: "testResource2",
            path: "testResource2",
            components: resourceTemplate.components.map((component) => ({
              ...component,
              encrypted: true,
            })),
          })
          .expect(403)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(
              res.text,
              `Cannot set field "textField" to encrypted, the Security & Compliance package is required to use field-level encryption`
            );
            done();
          });
      });

      it("Should not be able update a resource component to create a database index", function (done) {
        request(app)
          .put(`/project/${project._id}/form/${resourceId}`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            components: resourceTemplate.components.map((component) => ({
              ...component,
              dbIndex: true,
            })),
          })
          .expect(403)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it("Should not be able set field to encrypted", function (done) {
        request(app)
          .put(`/project/${project._id}/form/${resourceId}`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            components: resourceTemplate.components.map((component) => ({
              ...component,
              encrypted: true,
            })),
          })
          .expect(403)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            done();
          });
      });

      it("Should not be able to modify a resource to add a submission collection", function (done) {
        request(app)
          .put(`/project/${project._id}/form/${resourceId}`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            settings: { collection: "textField" },
          })
          .expect(403)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(
              res.text,
              `The Security & Compliance package is required to use Submission Collections`
            );
            done();
          });
      });
    });

    describe("S+C license is set", function () {
      before(function () {
        process.env.TEST_SIMULATE_SAC_PACKAGE = '1';
        process.env.ADMIN_KEY = "examplekey";
      });

      if (config.formio.hosted) {
        it("Hosted projects should NOT be able to create a resource with a submission collection", function (done) {
          request(app)
            .post(`/project/${project._id}/form/`)
            .set("x-admin-key", process.env.ADMIN_KEY)
            .send({
              ...resourceTemplate,
              title: "testResource1",
              name: "testResource1",
              path: "testResource1",
              settings: {
                collection: "textField",
              },
            })
            .expect(403)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }
              assert.equal(res.text, `Your project cannot be configured for Submission Collections`);
              done()
            });
        });

        return;
      }

      it("Should not be able to create resource with index without a submission collection", function (done) {
        request(app)
          .post(`/project/${project._id}/form`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            ...resourceTemplate,
            title: "testResource1",
            name: "testResource1",
            path: "testResource1",
            components: resourceTemplate.components.map((component) => ({
              ...component,
              dbIndex: true,
            })),
          })
          .expect(403)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(
              res.text,
              `Cannot create index at path "textField", a Submission Collection is required to create database indexes`
            );
            done();
          });
      });

      it("Should be able to create a resource with a submission collection", function (done) {
        request(app)
          .post(`/project/${project._id}/form/`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            ...resourceTemplate,
            title: "testResource1",
            name: "testResource1",
            path: "testResource1",
            settings: {
              collection: "textField",
            },
          })
          .expect(201)
          .end(async function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(res.body.settings.collection, "textField");
            resourceId = res.body._id;
            const mockReq = { projectId: project._id, params: {}, path: '' };
            try {
              const model = await getSubmissionModel(
                app.formio.formio,
                mockReq,
                res.body,
                false);
              assert.equal(model.collection.name, "sacTestProject_textField");
              done();
            } catch (err) {
              done(err);
            }
          });
      });

      it("Should be able to update a resource's submission collection", function (done) {
        request(app)
          .put(`/project/${project._id}/form/${resourceId}`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            settings: {
              collection: "textFieldNew",
            },
          })
          .expect(200)
          .end(async function (err, res) {
            if (err) {
              return done(err);
            }
            const mockReq = { projectId: project._id, path: '', params: {} };
            try {
              const model = await getSubmissionModel(
                app.formio.formio,
                mockReq,
                res.body,
                false);
              assert.equal(model.collection.name, "sacTestProject_textFieldNew");
              done();
            } catch (err) {
              done(err);
            }
          });
      });

      it("Should be able to update a resource's access settings", function (done) {
        request(app)
          .put(`/project/${project._id}/form/${resourceId}`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            access: [
              {
              type: "read_all",
              roles: [],
            }
          ],
          })
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.deepEqual(res.body.access, [{type: "read_all", roles: []}]);
            done();
          });
      });

      it("Should gracefully handle error if encountering indexing error and roll back (NOTE: may not fail if using CosmosDB)", function (done) {
        request(app)
          .post(`/project/${project._id}/form`)
          .set("x-admin-key", process.env.ADMIN_KEY)
          .send({
            ...resourceTemplate,
            title: "testResource2",
            name: "testResource2",
            path: "testResource2",
            components: Array.from({ length: 120 }, (_, idx) => ({
              label: String(idx + 1),
              tableView: true,
              key: `textField${idx}`,
              type: "textfield",
              input: true,
              dbIndex: true,
            })),
            settings: {
              collection: "textField",
            },
          })
          .expect(400)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            assert.equal(res.ok, false);
            assert(res.text.includes("too many indexes"));
            done();
          });
      });
    });
  });
};
