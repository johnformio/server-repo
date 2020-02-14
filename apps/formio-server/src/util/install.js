'use strict';
const template = require('../../project.json');
const debug = {
  install: require('debug')('formio:install')
};

module.exports = (app, config, next) => {
  const formio = app.formio.formio;
  const log = (...args) => {
    debug.install(...args);
    formio.util.log(...args);
  };

  log('\nChecking environment status. ');
  if (!config.licenseData || !config.licenseData.portal) {
    log(' > No on-premise portal license. Use https://portal.form.io to connect this environment.\n');
    return next();
  }
  if (!process.env.PRIMARY) {
    log(' > This environment is set up as a SECONDARY environment.');
    log(' > Use a primary environment or htps://portal.form.io to connect to this environment.');
    return next();
  }
  try {
    formio.resources.project.model.findOne({primary: true}, (err, project) => {
      if (err) {
        log(' > Error:', err);
        return next();
      }
      if (project) {
        log(' > Existing primary project found.');
        return next();
      }
      log(' > Starting primary project install');
      const alters = formio.hook.alter('templateAlters', {});

      template.isPrimary = true;
      formio.template.import.template(template, alters, function(err, template) {
        if (err) {
          log('Error: ', err);
        }
        log(' > Finished creating primary project\n');
        formio.resources.project.model.findOne({
          name: template.name
        }, (err, project) => {
          formio.resources.role.model.findOne({
            project: project._id,
            title: 'Authenticated'
          }, (err, authenticated) => {
            formio.resources.form.model.findOne({
              project: project._id,
              name: 'user'
            }, (err, form) => {
              log('Creating Super Admin acount');
              const email = process.env.ADMIN_EMAIL || 'admin@example.com';
              const password = process.env.ADMIN_PASS || 'p@ssw0rd!';
              formio.encrypt(password, function(err, hash) {
                formio.resources.submission.model.create({
                  project: project._id,
                  form: form._id,
                  data: {
                    fullName: 'Admin',
                    name: 'admin',
                    email,
                    password: hash
                  },
                  roles: [
                    authenticated._id
                  ]
                }, (err, user) => {
                  log(` > Super Admin account created for ${  email  }/${  password}`);
                  if (email === 'admin@example.com') {
                    log(' > Be sure to change the email and password for this account or your environment will not be secure.');
                  }
                  project.owner = user._id;
                  project.save();
                  return next();
                });
              });
            });
          });
        });
      });
    });
  }
  catch (e) {
    log(e);
    return next();
  }
};
