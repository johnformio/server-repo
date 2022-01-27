'use strict';
const _ = require('lodash');

const components = [
  {
    "label": "Submission Change Log",
    "reorder": false,
    "addAnotherPosition": "bottom",
    "layoutFixed": false,
    "enableRowGroups": false,
    "initEmpty": false,
    "tableView": false,
    "defaultValue": [
        {}
    ],
    "key": "changeLogDataGrid",
    "type": "datagrid",
    "input": true,
    "components": [
        {
            "label": "Container",
            "tableView": false,
            "key": "container",
            "type": "container",
            "input": true,
            "hideLabel": true,
            "components": [
                {
                    "label": "Revision Id",
                    "labelPosition": "left-left",
                    "labelWidth": 10,
                    "labelMargin": 3,
                    "tableView": true,
                    "key": "revisionId",
                    "type": "textfield",
                    "input": true
                },
                {
                  "label": "Date / Time",
                  "labelPosition": "left-left",
                  "labelWidth": 10,
                  "labelMargin": 3,
                  "tableView": false,
                  "enableMinDateInput": false,
                  "datePicker": {
                      "disableWeekends": false,
                      "disableWeekdays": false
                  },
                  "enableMaxDateInput": false,
                  "key": "dateTime",
                  "type": "datetime",
                  "input": true,
                  "widget": {
                      "type": "calendar",
                      "displayInTimezone": "viewer",
                      "locale": "en",
                      "useLocaleSettings": false,
                      "allowInput": true,
                      "mode": "single",
                      "enableTime": true,
                      "noCalendar": false,
                      "format": "yyyy-MM-dd hh:mm a",
                      "hourIncrement": 1,
                      "minuteIncrement": 1,
                      "time_24hr": false,
                      "minDate": null,
                      "disableWeekends": false,
                      "disableWeekdays": false,
                      "maxDate": null
                  }
                },
                {
                  "label": "User Id",
                  "labelPosition": "left-left",
                  "labelWidth": 10,
                  "labelMargin": 3,
                  "tableView": true,
                  "key": "userId",
                  "type": "textfield",
                  "input": true
                },
                {
                  "label": "Reason",
                  "labelPosition": "left-left",
                  "labelWidth": 10,
                  "labelMargin": 3,
                  "tableView": true,
                  "key": "reason",
                  "type": "textarea",
                  "input": true
                },
                {
                    "label": "Revision Id: ",
                    "reorder": false,
                    "addAnotherPosition": "bottom",
                    "layoutFixed": false,
                    "enableRowGroups": false,
                    "initEmpty": false,
                    "hideLabel": true,
                    "tableView": false,
                    "key": "dataGrid1",
                    "type": "datagrid",
                    "input": true,
                    "components": [
                        {
                            "label": "Field Path",
                            "tableView": true,
                            "key": "fieldPath",
                            "type": "textarea",
                            "input": true
                        },
                        {
                          "label": "Previous Value",
                          "tableView": true,
                          "key": "previousValue",
                          "type": "textarea",
                          "input": true
                      },
                        {
                            "label": "Entry Value",
                            "tableView": true,
                            "key": "entityValue",
                            "type": "textarea",
                            "input": true
                        }
                    ]
                }
            ]
        }
    ]
  }
];

const createRow = (entityValue, previousValue, fieldPath) => {
  entityValue = entityValue? entityValue : ' ';
  previousValue = previousValue? previousValue : ' ';
  return ({
  entityValue: entityValue.constructor && entityValue.constructor.name !== 'Date' ? entityValue.toString() : entityValue.toUTCString(),
  previousValue: previousValue.constructor && previousValue.constructor.name !== 'Date' ? previousValue.toString() : previousValue.toUTCString(),
  fieldPath
});
};

module.exports = (changelog, form, submission) => {
  if (changelog) {
    form.components.push(...components);

    const revisionData = changelog.map(revision => {
      const changes = [];
      revision.metadata.jsonPatch.forEach(change => {
        if (Array.isArray(change.value)) {
          change.value.forEach((val, valIndex) => {
            if (val.value && val.path) {
              changes.push({
                entityValue: val.value,
                previousValue: _.get(revision.metadata.previousData, `${val.path.slice(6).replace(/\//g, '.')}`),
                fieldPath: val.path.slice(6)
              });
            }
            else {
              Object.keys(val).forEach((entry, index) => changes.push(
                createRow(
                  val[entry],
                  _.get(revision.metadata.perviousData,`${change.path.slice(6).replace(/\//g, '.')}[${valIndex}]${entry}`),
                  `${change.path.slice(6)}/${valIndex}/${entry}`)
                ));
            }
          });
        }
        else if (change.value && typeof change.value === 'object' && change.value.constructor.name !== 'Date') {
          _.forIn(change.value, (val, key) => {
            changes.push(
              createRow(
                val,
                revision.data[change.path],
                `${change.path.slice(6)}/${key}`
                )
            );
          });
        }
        else {
          const previousValue = _.get(revision.metadata.previousData, change.path.slice(6).replace(/\//g, '.'));
          if (previousValue && typeof previousValue === 'object' && !Array.isArray(previousValue) && previousValue.constructor.name !== 'Date') {
          _.forIn(previousValue, (val, key) => changes.push(
            createRow(
              change.op === "remove" ? '' : val,
              _.get(revision.metadata.previousData, `${change.path.slice(6).replace(/\//g, '.')}.${key}`),
              change.path.slice(6)
              )
          ));
          }
else {
            return changes.push(
              createRow(
                change.op === "remove" ? '' : change.value,
                previousValue,
                change.path.slice(6)
                )
            );
          }
        }
      });

      return ({
        container: {
          revisionId: revision._id,
          dateTime: revision.modified,
          userId: revision._vuser,
          reason: revision.metadata.previousData? revision._vnote: 'Initial submission',
          dataGrid1: changes
        }
      });
    });

    const data = {
      changeLogDataGrid: revisionData
    };

    Object.assign(submission.data, data);
  }
};
