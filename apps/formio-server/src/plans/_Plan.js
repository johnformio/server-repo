'use strict';
const _ = require('lodash');

module.exports = class Plan {
  get data() {
    return {
      location: 'hosted',
      licenseName: '',
      startDate: '',
      endDate: '',
      formManagers: 0,
      pdfServers: 0,
      pdfDownloads: 10,
      pdfs: 1,
      projects: 1,
      tenants: 0,
      stages: 0,
      plan: 'trial',
      licenseKeys: [
        {
          key: '',
          name: 'Project',
          scope: ['project', 'stage', 'form', 'submissionRequest', 'formRequest', 'pdf', 'pdfDownload', 'email'],
        }
      ]
    };
  }

  getPlan() {
    const pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const data = this.data;
    data.startDate = new Date().toISOString();
    data.licenseKeys[0].key = _.times(30, () => pool[_.random(0, pool.length)]).join('');
    return data;
  }
};
