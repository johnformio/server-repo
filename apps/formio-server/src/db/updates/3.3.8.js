'use strict';
const _ = require('lodash');
const { ObjectId } = require('mongodb');
function idToBson(_id) {
  if (typeof _id === 'string') {
    _id = _id.replace(/[^0-9a-z]+/, '');
  }
  try {
    _id = _.isObject(_id)
      ? _id
      : new ObjectId(_id);
  }
  catch (e) {
    console.log(`Unknown _id given: ${_id}, typeof: ${typeof _id}`);
    _id = false;
  }

  return _id;
}

/**
 * Update 3.3.7
 *
 * Upgrades to the new email team structure.
 *
 * @param db
 * @param config
 * @param tools
 * @param done
 */
module.exports = async function(db, config, tools, done) {
  // Perform in background.
  done();
  const projects = db.collection('projects');
  const forms = db.collection('forms');
  const actions = db.collection('actions');
  const submissions = db.collection('submissions');
  const roles = db.collection('roles');
  const project = await projects.findOne({
    primary: true
  });
  if (!project) {
    console.log('No primary project found for updating teams.');
    return;
  }

  // Get the anonymous role.
  const anonymousRole = await roles.findOne({
    project: project._id,
    default: true
  });

  // Get the authenticated role.
  const authenticatedRole = await roles.findOne({
    project: project._id,
    title: "Authenticated"
  });

  // Get the current team resource
  const teamResource = await forms.findOne({
    project: project._id,
    name: 'team'
  });

  if (!teamResource) {
    console.log('No team resource found for email team update.');
    return;
  }

  // Update the team resource to the new structure.
  console.log('Updating team resource structure.');
  await forms.updateOne({
    _id: teamResource._id
  }, {
    $set: {
      "components": [
        {
          "label" : "Team Name",
          "key" : "name",
          "type" : "textfield",
          "placeholder" : "Enter the name for this team",
          "validate" : {
            "required" : true
          }
        },
        {
          "label" : "Submit",
          "key" : "submit",
          "type" : "button",
          "theme" : "primary"
        }
      ],
      "access": [
        {
          "type": "read_all",
          "roles": [anonymousRole._id, authenticatedRole._id]
        }
      ],
      "submissionAccess": []
    }
  });

  // Add a team member resource.
  let memberResource = await forms.findOne({
    project: project._id,
    name: 'member'
  });
  if (!memberResource) {
    console.log('Adding team member resource.');
    await forms.insertOne({
      title: 'Team Member',
      name: 'member',
      path: 'member',
      type: 'resource',
      tags: [],
      deleted: null,
      owner: null,
      components: [
        {
          "label" : "Team",
          "key" : "team",
          "type" : "select",
          "reference" : true,
          "dataSrc" : "resource",
          "data" : {
            "resource" : teamResource._id.toString()
          },
          "template" : "<span>{{ item.data.name }}</span>"
        },
        {
          "label": "User ID",
          "key": "userId",
          "type": "hidden"
        },
        {
          "label" : "Email",
          "key" : "email",
          "type" : "email",
          "validate" : {
            "required" : true
          }
        },
        {
          "label" : "Team Admin",
          "key" : "admin",
          "type" : "checkbox",
          "tooltip" : "Team Admins can add and remove other team members."
        },
        {
          "label" : "Submit",
          "key" : "submit",
          "type" : "button",
          "theme" : "primary"
        }
      ],
      "access": [
        {
          "type": "read_all",
          "roles": [authenticatedRole._id]
        }
      ],
      "submissionAccess": [],
      "machineName" : "formio:member",
      "project": project._id,
      "created": teamResource.created,
      "modified": teamResource.modified,
      "__v": 0,
      "_vid": 1,
      "revisions": ""
    });
    memberResource = await forms.findOne({
      project: project._id,
      name: 'member'
    });
    await actions.insertOne({
      "handler" : [
        "before"
      ],
      "method" : [
        "create",
        "update"
      ],
      "priority" : 10,
      "deleted" : null,
      "title" : "Save Submission",
      "name" : "save",
      "form" : memberResource._id,
      "machineName" : "formio:member:save",
      "__v" : 0
    });
  }

  // Iterate through all existing teams.
  console.log('Updating Teams: ');
  const cursor = submissions.find({
    project: project._id,
    form: teamResource._id,
    deleted: {$eq: null}
  });
  while(await cursor.hasNext()) {
    const team = await cursor.next();
    process.stdout.write('|');
    const addMember = async function(user, admin) {
      if (!user || !user.data || !user.data.email) {
        return;
      }
      process.stdout.write('.');
      return await submissions.insertOne({
        project: project._id,
        form: memberResource._id,
        deleted: null,
        roles: [],
        state: 'submitted',
        data: {
          team: {
            _id: team._id
          },
          userId: user._id.toString(),
          email: user.data.email,
          admin: admin,
          invite: false
        },
        access: [],
        metadata: {
          accepted: (_.get(user, 'metadata.teams', []).indexOf(team._id.toString()) !== -1) || user._id.toString() === team.owner.toString(),
        },
        externalIds: [],
        externalTokens: [],
        created: team.created,
        modified: team.modified,
        _vid: 0,
        _fvid: 1,
        __v: 0
      });
    };

    const members = team.data.members || [];
    const admins = team.data.admins || [];
    const total = members.length + admins.length;
    await Promise.all(admins.map(async (admin) => {
      return addMember(await submissions.findOne({_id: idToBson(admin._id.toString())}), true);
    }));
    await Promise.all(members.map(async (member) => {
      let isAdmin = false;
      if (!member || !member._id) {
        return;
      }
      if (member._id.toString() === team.owner.toString()) {
        isAdmin = true;
      }

      return addMember(await submissions.findOne({_id: idToBson(member._id.toString())}), isAdmin);
    }));

    // Update the team resource.
    await submissions.updateOne({
      _id: team._id
    }, {$set: {
      metadata: { memberCount: total },
      access: []
    }});
  }
  console.log('Done!');
};
