'use strict';
const {premium} = require('@formio/premium/dist/premium-server.min.js');
const fs = require('fs');
var path = require('path');

const customModulesPath = '../../modules/custom.js';

module.exports = ({Formio}) => {
  // eslint-disable-next-line no-debugger
  if (Formio && 'use' in Formio) {
    Formio.use(premium);
  }

  fs.access(path.resolve(__dirname, customModulesPath), function(err) {
    if (err) {
      console.log(err);
    }
    else {
      if (Formio && 'use' in Formio) {
        Formio.use(require(path.resolve(__dirname, customModulesPath)));
      }
    }
  });
  return Formio;
};
