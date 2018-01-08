'use strict';

require('./server')()
.then(function(server) {
  /* eslint-disable no-console */
  console.log(` > Listening to ${  server.config.protocol  }://${  server.config.domain  }:${  server.config.port}`);
  /* eslint-enable no-console */
  server.app.listen(server.config.port);
});
