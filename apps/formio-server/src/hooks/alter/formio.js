'use strict';

module.exports = router => app => {
  if (app.formio && app.formio.formio) {
    return app.formio.formio;
  }
  else if (app.formio) {
    return app.formio;
  }

  return app;
};
