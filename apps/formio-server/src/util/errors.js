'use strict';

class LicenseError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

class ValidationError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

module.exports = {LicenseError, ValidationError};
