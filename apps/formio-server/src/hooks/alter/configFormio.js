'use strict';
const premium = require('@formio/premium/dist/premium-server.min.js');

module.exports = Formio => {
  if (Formio && 'use' in Formio) {
    Formio.use(premium);
  }

  return Formio;
};
