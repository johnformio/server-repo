'use strict';

module.exports = (app) => (req, actionName, settingsForm) => {
  const hook = app.formio.formio.hook;

  switch (actionName) {
    case 'SaveSubmission': {
      const basePath = hook.alter('path', '/form', req);
      const formPasswordFieldsQuery = `${basePath}/${req.params.formId}/components?type=password`;

      return settingsForm.concat([
        {
          label: 'Password protected update',
          key: 'passwordProtectedUpdate',
          type: 'checkbox',
          input: true,
        },
        {
          type: 'select',
          input: true,
          label: 'Password Field',
          key: 'passwordField',
          placeholder: 'Select the password input field',
          template: '<span>{{ item.label || item.key }}</span>',
          dataSrc: 'url',
          data: {url: formPasswordFieldsQuery},
          valueProperty: 'key',
          multiple: false,
          validate: {
            required: true,
          },
          customConditional: 'show = data.passwordProtectedUpdate',
        },
        {
          label: 'Update password',
          key: 'updatePassword',
          type: 'checkbox',
          input: true,
          customConditional: 'show = data.passwordProtectedUpdate',
        },
        {
          type: 'select',
          input: true,
          label: 'New Password Field',
          key: 'newPasswordField',
          placeholder: 'Select the new password field',
          template: '<span>{{ item.label || item.key }}</span>',
          dataSrc: 'url',
          data: {url: formPasswordFieldsQuery},
          valueProperty: 'key',
          multiple: false,
          validate: {
            required: true,
          },
          customConditional: 'show = data.updatePassword',
        },
      ]);
    }
    default: {
      return settingsForm;
    }
  }
};
