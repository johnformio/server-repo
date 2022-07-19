'use strict';
const projectCache = require('../cache/projectCache');

const template = require('../../project.json');
const debug = {
  install: require('debug')('formio:install')
};
const portalEnabled = (process.env.PRIMARY && process.env.PRIMARY !==  'false') || (process.env.PORTAL_ENABLED && process.env.PORTAL_ENABLED !==  'false');

module.exports = (app, config, next) => {
  const formioServer = app.formio;
  const loadCache = projectCache(formioServer);
  const formio = app.formio.formio;
  const log = (...args) => {
    debug.install(...args);
    formio.util.log(...args);
  };

  log('\nChecking environment status. ');
  if (!portalEnabled) {
    log(' > This environment is set up as a REMOTE environment.');
    log(' > Use a PORTAL environment to connect to this environment.');
    return next();
  }
  try {
    loadCache.load({primary: true}, (err, project) => {
      if (err) {
        log(' > Error:', err);
        return next();
      }
      if (project) {
        log(' > Existing portal project found.');
        return next();
      }
      log(' > Starting portal project install');
      const alters = formio.hook.alter('templateAlters', {});

      template.isPrimary = true;
      formio.template.import.template(template, alters, function(err, template) {
        if (err) {
          log('Error: ', err);
        }
        log(' > Finished creating portal project\n');
        loadCache.load({
          name: template.name
        }, (err, project) => {
          formio.resources.role.model.findOne({
            project: project._id,
            title: 'Administrator'
          }, (err, administrator) => {
            formio.resources.form.model.findOne({
              project: project._id,
              name: 'admin'
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
                    administrator._id
                  ]
                }, (err, user) => {
                  log(` > Super Admin account created for ${  email  }/${  password}`);
                  if (email === 'admin@example.com') {
                    log(
                      ' > Be sure to change the email and password for this ' +
                      'account or your environment will not be secure.'
                    );
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
