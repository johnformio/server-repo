'use strict';

const datasource = require('./datasource');

module.exports = app => ({
  datasource: datasource(app),
});
