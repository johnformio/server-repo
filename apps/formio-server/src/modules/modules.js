'use strict';

module.exports = function(app, config) {
  return {
    websocket: require('./websocket')(app, config)
  };
};
