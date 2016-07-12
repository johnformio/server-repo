'use strict';

require('./server')()
.then(function(server) {
  server.app.listen(server.config.port);
});
