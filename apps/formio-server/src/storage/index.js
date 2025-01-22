'use strict';
const dropbox = require('./dropbox');
const s3 =require('./s3');
const azure = require('./azure');
const googledrive = require('./googleDrive');

const storages = {
  dropbox,
  s3,
  azure,
  googledrive,
};

const mountStorages = (router) => ({
  dropbox: dropbox.middleware(router),
  s3: s3.middleware(router),
  azure: azure.middleware(router),
  googledrive: googledrive.middleware(router),
});

module.exports = {
  mountStorages,
  storages,
};
