const { fork } = require("child_process");
const { join } = require("path");

module.exports = class MockServer {
  setup(file, protocol, port, path, responseCode, data) {
    return new Promise((resolve, reject) => {
      try {
        this.hooksReceived = [];
        /*
        * process.argv[2] => port
        * process.argv[3] => path
        * process.argv[4] => response code
        * process.argv[5] => response data
        */
        this.process = fork(join(__dirname, file), [
          port,
          path,
          responseCode,
          JSON.stringify(data),
        ]);

        this.process.on("message", (message) => {
          if (message.ready) {
            resolve(`${protocol}://localhost:${port}${path ? path : ""}`);
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
    this.process.kill("SIGKILL");
  }

  clearReceivedHooks() {
    this.process.send({ clearHooks: true });
    this.hooksReceived = [];
  }
}
