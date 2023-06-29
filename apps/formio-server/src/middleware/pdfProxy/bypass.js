'use strict';

// regex for '/pdf/:project/file/:file.html | pdf' path
const regex = /^\/pdf\/[\w\d]+\/file\/[\w\d-]+\.(html|pdf)$/;

module.exports = function(req, res, next) {
  if ((req.method === 'GET' && regex.test(req.path)) || req.method === 'OPTIONS') {
    req.bypass = true;
    return next();
  }
  next();
};
