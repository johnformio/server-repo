'use strict';
const _ = require('lodash');
const async = require('async');

/**
 * Update 3.3.6
 *
 * Automatically adds all teams to user teams array.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = function(db, config, tools, done) {
  // Perform in background.
  done();
  const projects = db.collection('projects');
  projects.findOne({
    primary: true
  }, function(err, project) {
    if (err) {
      console.log(err.message);
      return;
    }

    if (!project) {
      return;
    }

    // Get the team resource.
    const forms = db.collection('forms');
    forms.findOne({
      project: project._id,
      name: 'team'
    }, function(err, teamResource) {
      if (err) {
        console.log(err.message);
        return;
      }

      if (!teamResource) {
        return;
      }

      // Get all submissions in the team resource.
      const submissions = db.collection('submissions');

      // Accept a team.
      const acceptTeam = function (team, member, next) {
        submissions.findOne({
          _id: tools.util.idToBson(member._id)
        }, function (err, member) {
          if (err) {
            console.log(err.message);
            return next();
          }

          if (!member) {
            return next();
          }

          if (!member.metadata) {
            member.metadata = {};
          }
          if (!member.metadata.teams) {
            member.metadata.teams = [];
          }

          // This member is already a part of this team.
          if (member.metadata.teams.indexOf(team._id.toString()) !== -1) {
            return next();
          }

          member.metadata.teams.push(team._id.toString());
          member.metadata.teams = _.uniq(member.metadata.teams);
          process.stdout.write('.');
          submissions.updateOne({
            _id: member._id
          }, {$set: {'metadata': member.metadata}}, next);
        });
      };

      const updateTeam = function (team, next) {
        process.stdout.write('|');
        async.eachSeries(team.data.members,
          (member, nextMember) => acceptTeam(team, member, nextMember),
          () => {
            async.eachSeries(team.data.admins,
              (member, nextMember) => acceptTeam(team, member, nextMember),
              next
            );
          }
        );
      };

      console.log('Updating teams.');
      const cursor = submissions.find({
        deleted: {$eq: null},
        form: teamResource._id
      });

      function processItem(err, team, count = 0) {
        if (err && (count < 100)) {
          return cursor.next(processItem, ++count);
        }
        if (err || (team === null)) {
          return; // All done!
        }

        updateTeam(team, function (err) {
          cursor.next(processItem);
        });
      }

      cursor.next(processItem);
    });
  });
};
