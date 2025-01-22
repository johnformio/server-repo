/* eslint-env mocha */
"use strict";

const request = require("supertest");
const assert = require("assert");

const docker = process.env.DOCKER;

module.exports = function (app, template, hook) {
  describe("SSO Teams", () => {
    describe("With SSO Team Enabled", () => {
      if (docker) {
        return;
      }

      let ssoTeam = {
        data: {
          name: "Test SSO Team",
          admins: [],
          members: [],
        },
        metadata: {
          ssoteam: true,
        },
      };

      let team, user, userToken;

      it("Should create the SSO Team", (done) => {
        request(app)
          .post(`/team`)
          .set("x-jwt-token", template.formio.teamAdmin.token)
          .send(ssoTeam)
          .expect("Content-Type", /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }

            team = res.body;
            done();
          });
      });

      it("Should create a user", (done) => {
        request(app)
          .post(
            `/project/${template.formio.project._id}/form/${template.formio.userResource._id}/submission`
          )
          .set("x-jwt-token", template.formio.owner.token)
          .send({
            data: {
              name: "Test",
              email: "test@fake.com",
              password: "testing123",
            },
          })
          .expect(201)
          .expect("Content-Type", /json/)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }

            user = res.body;
            // get the token for later
            request(app)
              .post(
                `/${template.formio.project.name}/${template.formio.userResource.name}/login`
              )
              .send({
                data: {
                  email: user.data.email,
                  password: "testing123",
                },
              })
              .end(function (err, res) {
                if (err) {
                  return done(err);
                }
                userToken = res.headers["x-jwt-token"];
                done();
              });
          });
      });

      it("Should not be able to invite the user to an SSO Team using the /member endpoint", (done) => {
        request(app)
          .post(`/team/${team._id}/member`)
          .set("x-jwt-token", template.formio.teamAdmin.token)
          .send({
            data: {
              team,
              userId: "",
              email: user.data.email,
              admin: false,
            },
            state: "submitted",
          })
          .expect(403)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            assert.equal(res.text, "Cannot perform this action on an SSO Team");
            done();
          });
      });

      it("Should be possible to 'invite' a user by submitting to the team member submission endpoint", (done) => {
        request(app)
          .post(
            `/project/${template.formio.project._id}/form/${template.formio.memberResource._id}/submission`
          )
          .set("x-jwt-token", template.formio.owner.token)
          .send({
            data: {
              team,
              userId: "",
              email: user.data.email,
              admin: false,
            },
          })
          .expect("Content-Type", /json/)
          .expect(201)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            assert(
              res.body.hasOwnProperty("_id"),
              "Submission should have been successfully created"
            );
            done();
          });
      });

      it("Should not be possible to accept an 'invite' to an SSO Team using the /join endpoint, even if 'invited'", (done) => {
        request(app)
          .post(`/team/${team._id}/join`)
          .set("x-jwt-token", userToken)
          .expect(403)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert.equal(res.text, "Cannot perform this action on an SSO Team");
            done();
          });
      });

      it("Should not be possible to leave an SSO team, even if 'invited'", (done) => {
        request(app)
          .post(`/team/${team._id}/leave`)
          .set("x-jwt-token", userToken)
          .expect(403)
          .end((err, res) => {
            if (err) {
              done(err);
            }
            assert.equal(res.text, "Cannot perform this action on an SSO Team");
            done();
          });
      });
    });
  });
};
