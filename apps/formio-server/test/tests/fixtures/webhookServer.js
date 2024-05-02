const express = require("express");

const webhookServer = express();

webhookServer.use(express.json());

let hooksRecieved = [];

let port = 1337;
let path = "/hooks";
let responseCode = 200;
let response = null;
if (process.argv.length > 2) {
  port = process.argv[2] !== 'null' && process.argv[2] !== 'undefined' ? process.argv[2] : port;
  path = process.argv[3] !== 'null' && process.argv[3] !== 'undefined' ? process.argv[3] : path;
  responseCode = process.argv[4] !== 'null' && process.argv[4] !== 'undefined' ? process.argv[4] : responseCode;
  response = process.argv[5] !== 'null' && process.argv[5] !== 'undefined' ? JSON.parse(process.argv[5]) : response;
}
let attempts = 0;

webhookServer.post(path, async (req, res) => {
  const hookData = { recievedAt: Date(), headers: req.headers, body: req.body, url: req.url };

  if (path === '/retry') {
    if (attempts < 4 ) {
      attempts++;
    }
    else {
      responseCode = 201;
      response = {...req.body, attempts};
    }
  }
  if (!response) {
    res.sendStatus(responseCode);
  }
  else {
    res.status(responseCode).json(response);
  }
  hooksRecieved.push(hookData);
  process.send(hookData);
});

webhookServer.get(path, (req, res) => {
  res.send(JSON.stringify(hooksRecieved));
});

webhookServer.put(path, async (req, res) => {
  const hookData = { recievedAt: Date(), headers: req.headers, body: req.body, url: req.url };
  res.send();
  process.send(hookData);
});

webhookServer.delete(path, async (req, res) => {
  const hookData = { recievedAt: Date(), headers: req.headers, url: req.url };
  res.send();
  process.send(hookData);
});

process.on("message", function (message) {
  if (message.clearHooks) {
    hooksRecieved = [];
  }
});

webhookServer.listen(port, () => {
  process.send({ready: true});
  console.log(`Listening for hooks at ${path} on ${port}`);
});
