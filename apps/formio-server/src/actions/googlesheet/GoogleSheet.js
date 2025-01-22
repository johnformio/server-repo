'use strict';

const _ = require('lodash');
const debug = require('debug')('formio:action:googlesheet');
const SpreadsheetColumn = (new (require('spreadsheet-column'))());
const router = require('express').Router();
const {google} = require('googleapis');

class GoogleSheet {
  authenticate(config) {
    return new Promise((resolve, reject) => {
      try {
        // Authenticate with OAuth2.
        const oauth2Client = new google.auth.OAuth2(
          config.client_id,
          config.client_secret,
          'urn:ietf:wg:oauth:2.0:oob'
        );
        oauth2Client.setCredentials({
          refresh_token: config.refresh_token // eslint-disable-line camelcase
        });
        debug('Authenticating with Google');
        oauth2Client.refreshAccessToken()
          .then(() => {
            debug('Authentication complete.');
            resolve(google.sheets({
              version: 'v4',
              auth: oauth2Client
            }));
          })
          .catch((err) => {
            debug(err);
            reject(err);
          });
      }
      catch (err) {
        debug(err);
        reject(err);
      }
    });
  }

  getColumns(settings, data = {}) {
    return _(settings)
      .toPairs()
      .reject(([key, column]) => [
        'sheetID',
        'worksheetName',
        'spreadSheetStartRow',
        'externalIdType',
      ].includes(key) || !column)
      .map(([key, column]) => ({
        value: _.get(data, key),
        index: SpreadsheetColumn.fromStr(column),
        column: column.toUpperCase()
      }))
      .sortBy('index')
      .value();
  }

  getRange(columns, row) {
    if (!columns.length) {
      return '';
    }

    const head = _.head(columns).column;
    const last = _.last(columns).column;

    return `${head}${row}:${last}${row}`;
  }

  getValues(columns) {
    if (!columns.length) {
      return [];
    }

    const headIndex = _.head(columns).index;
    const colsCount = _.last(columns).index - headIndex;
    const values = new Array(colsCount).fill('');

    columns.forEach((column) => values[column.index - headIndex] = column.value);

    return values;
  }

  addRow(config, settings, data) {
    return this.authenticate(config).then((sheets) => new Promise((resolve, reject) => {
      try {
        const columns = this.getColumns(settings, data);
        const values = this.getValues(columns);
        const headColumn = _.head(columns);
        const startColumn = headColumn ? headColumn.column : 'A';
        const startRow = settings.spreadSheetStartRow || '2';

        debug('Appending row to spreadsheet.');
        sheets.spreadsheets.values.append({
          spreadsheetId: settings.sheetID,
          range: `${settings.worksheetName}!${startColumn}${startRow}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [values]
          }
        })
          .then((resp) => {
            const match = resp.data.updates.updatedRange.match(/.*![A-Z]+([0-9]+)/);
            if (match && match.length > 1) {
              return resolve({
                rowId: parseInt(match[1], 10)
              });
            }
            else {
              debug('Could not determine the row index.');
              return reject('Could not determine the row index.');
            }
          })
          .catch((err) => {
            debug(err);
            return reject(err);
          });
      }
      catch (err) {
        debug(err);
        return reject(err);
      }
    }));
  }

  updateRow(config, settings, row, data) {
    return this.authenticate(config).then((sheets) => new Promise((resolve, reject) => {
      try {
        const columns = this.getColumns(settings, data);
        const range = this.getRange(columns, row);
        const values = this.getValues(columns);

        sheets.spreadsheets.values.update({
          spreadsheetId: settings.sheetID,
          range: `${settings.worksheetName}!${range}`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [values]
          }
        })
          .then(() => resolve('OK'))
          .catch((err) => {
            debug(err);
            return reject(err);
          });
      }
      catch (err) {
        debug(err);
        return reject(err);
      }
    }));
  }

  deleteRow(config, settings, row) {
    return this.authenticate(config).then((sheets) => new Promise((resolve, reject) => {
      try {
        const columns = this.getColumns(settings);
        const range = this.getRange(columns, row);

        sheets.spreadsheets.values.clear({
          spreadsheetId: settings.sheetID,
          range: `${settings.worksheetName}!${range}`
        })
          .then(() => resolve('OK'))
          .catch((err) => {
            debug(err);
            return reject(err);
          });
      }
      catch (err) {
        debug(err);
        return reject(err);
      }
    }));
  }

  get router() {
    router.post('/row', (req, res) =>
      this.addRow(req.body.config, req.body.settings, req.body.data)
        .then((result) => res.status(201).json(result))
        .catch((err) => res.status(400).send(err.message || err)));

    router.put('/row/:rowId', (req, res) =>
      this.updateRow(req.body.config, req.body.settings, req.params.rowId, req.body.data)
        .then(() => res.status(200).send('OK'))
        .catch((err) => res.status(400).send(err.message || err)));

    router.delete('/row/:rowId', (req, res) =>
      this.deleteRow(req.body.config, req.body.settings, req.params.rowId)
      .then(() => res.status(200).send('OK'))
      .catch((err) => res.status(400).send(err.message || err)));

    return router;
  }
}

module.exports = GoogleSheet;
