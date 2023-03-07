'use strict';

const PDF_SERVER = process.env.PDF_SERVER || process.env.FORMIO_FILES_SERVER;
module.exports = {
  getPDFUrls(project) {
    let localServer;
    if (project.settings && project.settings.pdfserver) {
      localServer = project.settings.pdfserver;
    }
    else {
      localServer = PDF_SERVER;
      if (localServer === 'http://pdf-server:4005') {
        const appOrigin = project.settings && project.settings.appOrigin ? project.settings.appOrigin : '';
        localServer = `${appOrigin}/pdf`;
      }
      else if (!localServer) {
        throw Error('PDF server is not configured');
      }
    }

    return {
      local: localServer,
      public: (project.settings && project.settings.pdfserver) || localServer
    };
  }
};

