'use strict';

const config = require('../../config');

module.exports = (req, res, next) => {
  if (!config.onlyPrimaryWriteAccess) {
    return next();
  }

  if (!req.isAdmin) {
    return res.status(403).send('Permission Denied');
  }

  next();
};
