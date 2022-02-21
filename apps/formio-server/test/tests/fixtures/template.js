'use strict';

let _ = require('lodash');

module.exports = () => {
  // The default project template.
  let template = _.cloneDeep(require('formio/test/fixtures/template')());

  // Change the login timeouts for testing
  template.actions['adminLogin:login'].settings.lockWait = 4;
  template.actions['adminLogin:login'].settings.attemptWindow = 4;
  template.actions['userLogin:login'].settings.lockWait = 4;
  template.actions['userLogin:login'].settings.attemptWindow = 4;

  //// Add a new role and access to the template.
  //template.roles.client = {
  //  "title": "Client",
  //  "description": "A role for Client Users.",
  //  "admin": false,
  //  "default": false
  //};

  template.access = [
    {
      type: 'create_all',
      roles: ['administrator']
    },
    {
      type: 'read_all',
      roles: ['administrator']
    },
    {
      type: 'update_all',
      roles: ['administrator']
    },
    {
      type: 'delete_all',
      roles: ['administrator']
    }
  ];

  // An admin with form.io domain email.
  template.users.formioAdmin = {
    token: '',
    data: {
      email: 'useradmin@form.io',
      password: 'test1234567890'
    }
  }

  return template;
};
