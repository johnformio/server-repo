'use strict';
const mockBroswerContext = require('@formio/vm/build/mockBrowserContext');
mockBroswerContext.default();
const premium = require('@formio/premium');
const reporting = require('@formio/reporting');
const fs = require('fs');
var path = require('path');

const customModulesPath = '../../modules/custom.js';

module.exports = ({Formio}) => {
  // eslint-disable-next-line no-debugger
  if (Formio && 'use' in Formio) {
    Formio.use(premium);
    Formio.use(reporting);
  }

  fs.access(path.resolve(__dirname, customModulesPath), function(err) {
    if (err) {
      return Formio;
    }

    if (Formio && 'use' in Formio) {
      Formio.use(require(path.resolve(__dirname, customModulesPath)));
    }
    return Formio;
  });
};
