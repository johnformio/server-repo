'use strict';

module.exports = (analytics) => {
  const router = require('express').Router({mergeParams: true});
  router.get('/year/:year', (req, res, next) => {
    if (!req.params.projectId || !req.params.year) {
      return res.status(400).send('Expected params `year`.');
    }

    // Param validation.
    const curr = new Date();
    req.params.year = parseInt(req.params.year);
    if (req.params.year < 2015 || req.params.year > curr.getUTCFullYear()) {
      return res.status(400).send(`Expected a year in the range of 2015-${curr.getUTCFullYear()}.`);
    }

    const project = req.params.projectId.toString();
    const year = req.params.year.toString();
    analytics.redis.projectYear(project, year, (err, output) => {
      if (err) {
        return res.send(400).send(err.message);
      }

      return res.status(200).json(output);
    });
  });

  router.get('/year/:year/month/:month', (req, res, next) => {
    if (!req.params.projectId || !req.params.year || !req.params.month) {
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

    const project = req.params.projectId.toString();
    const year = req.params.year.toString();
    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    analytics.redis.projectMonth(project, year, month, (err, output) => {
      if (err) {
        return res.send(400).send(err.message);
      }

      return res.status(200).json(output);
    });
  });

  router.get('/year/:year/month/:month/day/:day', (req, res, next) => {
    if (!req.params.projectId || !req.params.year || !req.params.month || !req.params.day) {
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

    const project = req.params.projectId.toString();
    const year = req.params.year.toString();
    const month = (req.params.month - 1).toString(); // Adjust the month for zero index in timestamp.
    const day = req.params.day.toString();
    analytics.redis.projectDay(project, year, month, day, (err, output) => {
      if (err) {
        return res.send(400).send(err.message);
      }

      return res.status(200).json(output);
    });
  });
  return router;
};

