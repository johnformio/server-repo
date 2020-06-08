'use strict';
const NodeCache = require('node-cache');

class RequestCache {
  constructor() {
    this.namespaces = {};
  }

  addRequest(ns, key, requestData, ttl) {
    if (!ns || !key || !requestData) {
      return;
    }

    const {method, code} = requestData;

    let status;
    if (code >= 200 && code < 300) {
      status = '2xx';
    }
    else if (code < 400) {
      status = '3xx';
    }
    else if (code < 500) {
      status = '4xx';
    }
    else if (code < 600) {
      status = '5xx';
    }

    if (!status) {
      return;
    }

    const request = {method, status};

    this.namespaces[ns] = this.namespaces[ns] || new NodeCache();
    this.namespaces[ns].set(key, request, ttl);
  }

  getNamespaces() {
    return Object.keys(this.namespaces);
  }

  getRequestsData(ns) {
    if (!this.namespaces[ns]) {
      return {};
    }

    const data = {};
    const cache = this.namespaces[ns];

    cache.keys().forEach((key) => {
      const requestData = cache.get(key);

      if (!requestData) {
        return;
      }

      const {method, status} = requestData;

      if (!data[method]) {
        data[method] = {};
      }

      if (!data[method][status]) {
        data[method][status] = 1;
        return;
      }

      data[method][status] += 1;
    });

    return data;
  }
}

module.exports = RequestCache;
