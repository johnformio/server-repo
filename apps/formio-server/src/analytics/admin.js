'use strict';

const _ = require('lodash');
module.exports = (analytics) => {
  const router = require('express').Router();
  router.get('/project/year/:year', (req, res, next) => {
    if (!req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const year = req.params.year.toString();
    analytics.getFormioAnalytics('*', year, '*', '*', '*', res);
  });

  router.get('/project/year/:year/month/:month', (req, res, next) => {
    if (!req.params.year || !req.params.month) {
      return res.status(400).send('Expected params `year` and `month`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1-12.');
    }

    // Build the glob.
    const year = req.params.year.toString();
    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    analytics.getFormioAnalytics('*', year, month, '*', '*', res);
  });

  router.get('/project/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.year || !req.params.month || !req.params.day) {
      return res.status(400).send('Expected params `year`, `month`, and `day`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    req.params.day = parseInt(req.params.day);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1 - 12.');
    }
    if (!analytics.between(req.params.day, 1, 31)) {
      return res.status(400).send('Expected a day in the range of 1 - 31.');
    }

    // Build the glob.
    const year = req.params.year.toString();
    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const day = req.params.day.toString();
    analytics.getFormioAnalytics('*', year, month, day, '*', res);
  });

  router.get('/created/projects/year/:year', (req, res, next) => {
    if (!req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const query = {
      created: {
        $gte: new Date(req.params.year.toString()),
        $lt: new Date((req.params.year + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioProjectsCreated(query, res);
  });

  router.get('/created/projects/year/:year/month/:month', (req, res, next) => {
    if (!req.params.year || !req.params.month) {
      return res.status(400).send('Expected params `year` and `month`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1-12.');
    }

    // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
        $lt: new Date(req.params.year.toString(), (req.params.month).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioProjectsCreated(query, res);
  });

  router.get('/created/projects/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.year || !req.params.month || !req.params.day) {
      return res.status(400).send('Expected params `year`, `month`, and `day`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    req.params.day = parseInt(req.params.day);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1 - 12.');
    }
    if (!analytics.between(req.params.day, 1, 31)) {
      return res.status(400).send('Expected a day in the range of 1 - 31.');
    }

    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
        $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioProjectsCreated(query, res);
  });

  router.get('/created/users/year/:year', (req, res, next) => {
    if (!req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const query = {
      created: {
        $gte: new Date(req.params.year.toString()),
        $lt: new Date((req.params.year + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioUsersCreated(query, req, res);
  });

  router.get('/created/users/year/:year/month/:month', (req, res, next) => {
    if (!req.params.year || !req.params.month) {
      return res.status(400).send('Expected params `year` and `month`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1-12.');
    }

    // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
        $lt: new Date(req.params.year.toString(), (req.params.month).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioUsersCreated(query, req, res);
  });

  router.get('/created/users/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.year || !req.params.month || !req.params.day) {
      return res.status(400).send('Expected params `year`, `month`, and `day`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    req.params.day = parseInt(req.params.day);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1 - 12.');
    }
    if (!analytics.between(req.params.day, 1, 31)) {
      return res.status(400).send('Expected a day in the range of 1 - 31.');
    }

    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
        $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioUsersCreated(query, req, res);
  });

  router.get('/upgrades/projects/year/:year', (req, res, next) => {
    if (!req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const query = {
      created: {
        $gte: new Date(req.params.year.toString()),
        $lt: new Date((req.params.year + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getProjectUpgrades(query, req, res);
  });

  router.get('/upgrades/projects/year/:year/month/:month', (req, res, next) => {
    if (!req.params.year || !req.params.month) {
      return res.status(400).send('Expected params `year` and `month`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1-12.');
    }

    // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $gte: new Date(req.params.year.toString(), (req.params.month - 1).toString()),
        $lt: new Date(req.params.year.toString(), (req.params.month).toString())
      }
    };

    // Get the data and respond.
    analytics.getProjectUpgrades(query, req, res);
  });

  router.get('/upgrades/projects/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.year || !req.params.month || !req.params.day) {
      return res.status(400).send('Expected params `year`, `month`, and `day`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    req.params.day = parseInt(req.params.day);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1 - 12.');
    }
    if (!analytics.between(req.params.day, 1, 31)) {
      return res.status(400).send('Expected a day in the range of 1 - 31.');
    }

    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $gte: new Date(req.params.year.toString(), month, req.params.day.toString()),
        $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getProjectUpgrades(query, req, res);
  });

  router.get('/total/projects/year/:year', (req, res, next) => {
    if (!req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const query = {
      created: {
        $lt: new Date((req.params.year + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getProjectsCreated(query, req, res);
  });

  router.get('/total/projects/year/:year/month/:month', (req, res, next) => {
    if (!req.params.year || !req.params.month) {
      return res.status(400).send('Expected params `year` and `month`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1-12.');
    }

    // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $lt: new Date(req.params.year.toString(), (req.params.month - 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getProjectsCreated(query, req, res);
  });

  router.get('/total/projects/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.year || !req.params.month || !req.params.day) {
      return res.status(400).send('Expected params `year`, `month`, and `day`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    req.params.day = parseInt(req.params.day);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1 - 12.');
    }
    if (!analytics.between(req.params.day, 1, 31)) {
      return res.status(400).send('Expected a day in the range of 1 - 31.');
    }

    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getProjectsCreated(query, req, res);
  });

  router.get('/total/users/year/:year', (req, res, next) => {
    if (!req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const query = {
      created: {
        $lt: new Date((req.params.year + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioUsersCreated(query, req, res);
  });

  router.get('/total/users/year/:year/month/:month', (req, res, next) => {
    if (!req.params.year || !req.params.month) {
      return res.status(400).send('Expected params `year` and `month`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1-12.');
    }

    // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $lt: new Date(req.params.year.toString(), (req.params.month).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioUsersCreated(query, req, res);
  });

  router.get('/total/users/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.year || !req.params.month || !req.params.day) {
      return res.status(400).send('Expected params `year`, `month`, and `day`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    req.params.month = parseInt(req.params.month);
    req.params.day = parseInt(req.params.day);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015 - ${curr.getUTCFullYear()}.`);
    }
    if (!analytics.between(req.params.month, 1, 12)) {
      return res.status(400).send('Expected a month in the range of 1 - 12.');
    }
    if (!analytics.between(req.params.day, 1, 31)) {
      return res.status(400).send('Expected a day in the range of 1 - 31.');
    }

    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const query = {
      created: {
        $lt: new Date(req.params.year.toString(), month, (req.params.day + 1).toString())
      }
    };

    // Get the data and respond.
    analytics.getFormioUsersCreated(query, req, res);
  });

  router.post('/translate/project', (req, res, next) => {
    if (!req.body || !(req.body instanceof Array)) {
      return res.status(500).send('Expected array payload of project _id\'s.');
    }

    const projects = _(req.body)
      .uniq()
      .flattenDeep()
      .filter()
      .value();

    analytics.formio.resources.project.model.find({_id: {$in: projects}}, (err, projects) => {
      if (err) {
        return res.status(500).send(err);
      }

      projects = _(projects)
        .map((project) => {
          return {
            _id: project._id.toString(),
            name: project.name.toString() || '',
            title: project.title.toString() || '',
            plan: project.plan.toString(),
            owner: project.owner.toString(),
            created: project.created.toString()
          };
        })
        .value();

      return res.status(200).json(projects);
    });
  });

  router.post('/translate/owner', (req, res, next) => {
    if (!req.body || !(req.body instanceof Array)) {
      return res.status(500).send('Expected array payload of owner _id\'s.');
    }

    const owners = _(req.body)
      .uniq()
      .flattenDeep()
      .filter()
      .value();

    analytics.formio.cache.loadProjectByName(req, 'formio', (err, project) => {
      if (err || !project) {
        return res.sendStatus(401);
      }

      try {
        project = project.toObject();
      }
      catch (err) {
        // project was already a plain js object.
      }

      analytics.formio.resources.form.model.findOne({project: project._id, name: 'user'})
        .exec((err, form) => {
          if (err || !form) {
            return res.status(500).send(err);
          }

          try {
            form = form.toObject();
          }
          catch (err) {
            // n/a
          }

          analytics.formio.resources.submission.model.find({form: form._id, _id: {$in: owners}})
            .exec((err, owners) => {
              if (err) {
                return res.status(500).send(err);
              }

              owners = _(owners)
                .map((owner) => {
                  return {
                    _id: owner._id.toString(),
                    data: {
                      email: owner.data.email.toString() || '',
                      name: owner.data.name.toString() || ''
                    }
                  };
                })
                .value();

              return res.status(200).json(owners);
            });
        });
    });
  });

  return router;
};

