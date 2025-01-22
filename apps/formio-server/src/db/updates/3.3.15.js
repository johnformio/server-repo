'use strict';
const _ = require('lodash');

/**
 * Update 3.3.15
 *
 * Move user to admin.
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
  const submissions = db.collection('submissions');
  const actions = db.collection('actions');
  const roles = db.collection('roles');

  const project = await projects.findOne({
    primary: true
  });

  if (!project) {
    console.log('No primary project found.');
    return;
  }

  const adminRole = await roles.findOne({
    project: project._id,
    title: 'Administrator'
  });

  if (!adminRole) {
    console.log('No admin role found.');
    return;
  }

  let adminResource = await forms.findOne({
    project: project._id,
    type: 'resource',
    name: 'admin'
  });

  const userResource = await forms.findOne({
    project: project._id,
    type: 'resource',
    name: 'user'
  });

  if (!userResource) {
    console.log('No user resource found.');
    return;
  }

  if (!adminResource) {
    console.log('Creating admin resource.');
    const newAdminResource = _.cloneDeep(userResource);

    delete newAdminResource._id;
    newAdminResource.title = 'Admin';
    newAdminResource.name = 'admin';
    newAdminResource.path = 'admin';
    newAdminResource.machineName = 'formio:admin';

    const createdAdminResource = await forms.insertOne(newAdminResource);
    if (createdAdminResource.insertedId) {
      console.log('Created admin resource.');
    }
    else {
      return;
    }
  }

  adminResource = await forms.findOne({
    project: project._id,
    type: 'resource',
    name: 'admin'
  });

  const adminUser = await submissions.findOne({
    project: project._id,
    form: adminResource._id
  });

  if (!adminUser) {
    console.log('Moving user to admin.');
    const user = await submissions.findOne({
      project: project._id,
      form: userResource._id
    });

    if (!user) {
      console.log('User not found.');
      return;
    }

    const newRoles = _.cloneDeep(user.roles);
    newRoles.push(adminRole._id);

    await submissions.updateOne({
      _id: user._id
    }, {
      $set: {
        form: adminResource._id,
        roles: newRoles
      }
    });
    console.log('Moved user to amdin.');
  }

  const userLoginForm = await forms.findOne({
    project: project._id,
    name: 'userLoginForm'
  });

  if (!userLoginForm) {
    console.log('User login form not found.');
    return;
  }

  const loginAction = await actions.findOne({
    form: userLoginForm._id,
    name: 'login'
  });

  if (!loginAction) {
    console.log('Login action not found.');
    return;
  }

  const loginActionSettings = _.cloneDeep(loginAction.settings);
  loginActionSettings.resources = [userResource._id.toString(), adminResource._id.toString()];

  await actions.updateOne({
    _id: loginAction._id
  }, {
    $set: {
      settings: loginActionSettings
    }
  });

  console.log('Updated login action.');

  let adminRoleAssignmentAction = await actions.findOne({
    form: adminResource._id,
    title: 'Role Assignment'
  });

  if (!adminRoleAssignmentAction) {
    console.log('Creating admin Role Assignment action.')

    const userRoleAssignmentAction = await actions.findOne({
      form: userResource._id,
      title: 'Role Assignment'
    });

    if (!userRoleAssignmentAction) {
      console.log('No Role Assignment action found.');
      return;
    }

    adminRoleAssignmentAction = _.cloneDeep(userRoleAssignmentAction);

    delete adminRoleAssignmentAction._id;
    adminRoleAssignmentAction.settings.role = adminRole._id.toString();
    adminRoleAssignmentAction.form = adminResource._id;
    adminRoleAssignmentAction.machineName = 'formio:admin:role';

    const createdAdminRoleAssignmentAction = await actions.insertOne(adminRoleAssignmentAction);
    if (createdAdminRoleAssignmentAction.insertedId) {
      console.log('Created admin Role Assignment action.');
    }
    else {
      return;
    }
  }

  let adminSaveSubmissionAction = await actions.findOne({
    form: adminResource._id,
    title: 'Save Submission'
  });

  if (!adminSaveSubmissionAction) {
    console.log('Creating admin Save Submission action.')

    const userSaveSubmissionAction = await actions.findOne({
      form: userResource._id,
      title: 'Save Submission'
    });

    if (!userSaveSubmissionAction) {
      console.log('No Save Submission action found.');
      return;
    }

    adminSaveSubmissionAction = _.cloneDeep(userSaveSubmissionAction);

    delete adminSaveSubmissionAction._id;
    adminSaveSubmissionAction.form = adminResource._id;
    adminSaveSubmissionAction.machineName = 'formio:admin:save';

    const createdAdminSaveSubmissionAction = await actions.insertOne(adminSaveSubmissionAction);
    if (createdAdminSaveSubmissionAction.insertedId) {
      console.log('Created admin Save Submission action.');
    }
    else {
      return;
    }
  }

  console.log('Done!');
};
