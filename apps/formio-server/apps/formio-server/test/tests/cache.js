"use strict";

const request = require("supertest");
const assert = require("assert");
const _ = require("lodash");
const sinon = require("sinon");

module.exports = function (app, template, hook) {
  describe("Cache unit tests", function () {
    let cache;
    before(() => {
      cache = app.formio.formio.cache;
    });

    it("Should return undefined for a non-existent current project", async function () {
      const req = { projectId: "idonotexist" };
      const result = await cache.loadCurrentProject(req);
      assert.equal(result, undefined);
    });

    it("Should return undefined for a non-existent parent project", async function () {
      const req = { projectId: "idonotexist" };
      const result = await cache.loadParentProject(req);
      assert.equal(result, undefined);
    });

    it("Should return undefined for a non-existent primary project", async function () {
      const req = { projectId: "idonotexist" };
      const result = await cache.loadPrimaryProject(req);
      assert.equal(result, undefined);
    });
  });

  describe("Cache integration tests", function () {
    let project;
    before("Sets up a project", async function () {
      process.env.ADMIN_KEY = "examplekey";

      // Create a project
      const testProject = {
        title: "Cache Test Project",
        name: "cacheTestProject",
        plan: "commercial",
        type: "project",
      };
      const response = await request(app)
        .post("/project")
        .set("x-admin-key", process.env.ADMIN_KEY)
        .send(testProject)
        .expect("Content-Type", /json/)
        .expect(201);

      assert(response.body._id, "Response should have an _id");
      project = response.body;
    });

    it("Should return a 400 error for a non-existent project", async function () {
      const response = await request(app)
        .get("/project/idonotexist")
        .set("x-admin-key", process.env.ADMIN_KEY);
      assert(response.text.includes("Project not found"));
    });

    after("Deletes the project", async function () {
      await request(app)
        .delete(`/project/${project._id}`)
        .set("x-admin-key", process.env.ADMIN_KEY)
        .expect(200);
    });
  });
};
