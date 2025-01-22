'use strict';

require('./server')()
  .then(function(server) {
    /* eslint-disable no-console */
    console.log('');
    console.log(`Listening on port ${server.config.port}`);
    /* eslint-enable no-console */
    server.app.listen(server.config.port);
  });
