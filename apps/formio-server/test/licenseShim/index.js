const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');

const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

function md5(str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
}

function base64(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

app.use(async (req, res, next) => {
  if (!req.method === 'post') {
    return next();
  }
  console.log('request', req.body);
  let license;
  if (req.body.license) {
    license = await request({
      url: `${process.env.PROJECT}/license2/submission?data.licenseKey=${req.body.license}`,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': process.env.ADMIN_KEY,
      },
    });
  }
  res.send({
    ...req.body,
    hash: md5(base64(req.body)),
    used: {
      emails: 0,
      forms: 0,
      formRequests: 0,
      pdfs: 0,
      pdfDownloads: 0,
      submissionRequests: 0,
    },
    terms: license ? license.data : {
      plan: 'trial',
    },
    licenseId: 'abc123',
  });
});

console.log('Listening on port 4000');
app.listen(4000);

