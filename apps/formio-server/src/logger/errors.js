'use strict';

module.exports = () => {
  let middleware = (err, req, res, next) => {
    console.log(`in the error handler..`);
    handler(err)
    .then(() => {
      return res.sendStatus(500);
    })
    .catch(fatal => {
      console.log(`FATAL - ${fatal}`)
      return res.sendStatus(500);
    })
  };

  let handler = (err) => {
    // If this error has already been handled earlier in the stack, don't report it again.
    if (err._formio_handled) {
      return Promise.resolve()
    }

    err._formio_handled = true;
    console.log(`LOG ME: ${err.message || err}`)
    return Promise.resolve()
  };

  return {middleware, handler};
};
