'use strict';

const PDF_SERVER = process.env.PDF_SERVER || process.env.FORMIO_FILES_SERVER;
module.exports = {
  getPDFUrls(project) {
    let localServer = PDF_SERVER;
    if (!localServer) {
      if (project.settings && project.settings.pdfserver) {
        localServer = project.settings.pdfserver;
      }
      else {
        localServer = 'https://files.form.io';
      }
    }
    return {
      local: localServer,
      public: (project.settings && project.settings.pdfserver) || localServer
    };
  }
};
