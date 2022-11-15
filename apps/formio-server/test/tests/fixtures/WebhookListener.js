const { fork } = require("child_process");
const { join } = require("path");

module.exports = class WebhooksListener {
  setup(port, path, responseCode, data) {
    return new Promise((resolve, reject) => {
      try {
        this.hooksReceived = [];
        /*
        * process.argv[2] => port
        * process.argv[3] => path
        * process.argv[4] => response code
        * process.argv[5] => response data
        */
        this.hooksServerProcess = fork(join(__dirname, "webhookServer.js"), [
          port,
          path,
          responseCode,
          JSON.stringify(data),
        ]);

        this.hooksServerProcess.on("message", (message) => {
          if (message.ready) {
            resolve({ url: `http://localhost:${port}${path}`, processHandle: this.hookListenerProcess })
          }
          this.hooksReceived.push(message);
        });

        process.on("exit", () => {
          this.stop();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  stop() {
    this.hooksServerProcess.kill("SIGKILL");
  }

  clearReceivedHooks() {
    this.hooksServerProcess.send({ clearHooks: true });
    this.hooksReceived = [];
  }
}
