'use strict';
// Force load mailgun first before anything else
// Mailgun doesn't play nice when it loads with pollution in global variables
require('mailgun.js');

require('./server')()
  .then(function(server) {
    /* eslint-disable no-console */
    console.log('');
    console.log(`Listening on port ${server.config.port}`);
    /* eslint-enable no-console */
    server.app.listen(server.config.port);
  });
