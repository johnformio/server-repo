'use strict';
const _ = require('lodash');

const setRowCount = (rowNumber) => {
const cteateFormRow = (form, fieldPath, tableTemplate, components, index, revisionIndex, rowNumber) => {
    const pathArr = fieldPath.split('/');
    const key = pathArr.length>1 ? pathArr[pathArr.length - 1] : fieldPath;

    // eslint-disable-next-line no-undef
    FormioUtils.findComponent(form.components, key, null, (component) => {
      let valueComponent;
      if (component) {
        if (revisionIndex === 0 && !component.label.endsWith('&Delta;')) {
          component.label = `${component.label} &Delta;`;
        }
        if (component.type !== 'signature' && component.type !== 'sketchpad') {
          valueComponent = {
            "autoExpand": false,
            "tableView": true,
            "key": `fieldPath${rowNumber}`,
            "type": "textarea",
            "input": true
          };
        }
        else {
          valueComponent = component;
        }

      const rowTemplate = [
          {
              "components": [
                  {
                      "label": "Field Path",
                      "autoExpand": false,
                      "tableView": true,
                      "key": `fieldPath${rowNumber}`,
                      "type": "textarea",
                      "input": true,
                  }
              ]
          },
          {
              "components": [
                {
                  ...valueComponent,
                  "key": `previousValue${rowNumber}`,
                  "label": "Previous Value",
                }
              ]
          },
          {
              "components": [
                {
                  ...valueComponent,
                  "key": `entityValue${rowNumber}`,
                  "label": "Entity Value",
                }
              ]
          }
      ];

      tableTemplate.rows.push(rowTemplate);
      tableTemplate.numRows = tableTemplate.rows.length;

      if (index === 0 && rowNumber===revisionIndex) {
        const outerTemplate =[
          {
            "components":
            [{
               "label": "Revision Id",
               "labelPosition": "left-left",
               "labelWidth": 10,
               "labelMargin": 3,
               "tableView": true,
               "key": `revisionId${rowNumber}`,
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
             "key": `dateTime${rowNumber}`,
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
             "key": `userId${rowNumber}`,
             "type": "textfield",
             "input": true
           },
           {
             "label": "Reason",
             "labelPosition": "left-left",
             "labelWidth": 10,
             "labelMargin": 3,
             "tableView": true,
             "key": `reason${rowNumber}`,
             "type": "textarea",
             "input": true
           },
           tableTemplate
         ]
         },
         ];

         components[0].rows.push(
          outerTemplate
        );
        components[0].numRows = components[0].rows.length;
      }
      }
    });
};

const updatePath = (path, formComponents) => {
  const pathArr = path.split('/');
  const normalizeLabel = (str) => str.endsWith('&Delta;') ? str.slice(0, str.length-7) : str;
  let prevElement;
  const pathLabel = pathArr.map(key => {
    // eslint-disable-next-line no-undef
    const element = FormioUtils.getComponent(formComponents, key);
    if (element && element.label) {
      if (element.components) {
        prevElement = element;
      }
      return normalizeLabel(element.label);
    }
    else {
      if (prevElement) {
        // eslint-disable-next-line no-undef
        const innerElement = FormioUtils.getComponent(prevElement.components, key);
        return normalizeLabel(innerElement && innerElement.label ? innerElement.label : key);
      }
    }
  });
  return pathLabel.join('/ ');
};

const createSubmissionRow = (entityValue, previousValue, fieldPath, changes, revision, form) => {
  entityValue = entityValue===false || entityValue? entityValue : ' ';
  previousValue = previousValue===false || previousValue? previousValue : ' ';

  Object.assign( changes, {
  [`revisionId${rowNumber}`]: revision._id,
  [`dateTime${rowNumber}`]: revision.modified,
  [`userId${rowNumber}`]: revision._vuser,
  [`reason${rowNumber}`]: revision.metadata.previousData? revision._vnote: 'Initial submission',
  [`entityValue${rowNumber}`]: entityValue.constructor && entityValue.constructor.name !== 'Date' ? entityValue.toString() : entityValue.toUTCString(),
  [`previousValue${rowNumber}`]: previousValue.constructor && previousValue.constructor.name !== 'Date' ? previousValue.toString() : previousValue.toUTCString(),
  [`fieldPath${rowNumber}`]: updatePath(fieldPath, form.components)
});
};

const createRow = (entityValue, previousValue, fieldPath, form, changes, tableTemplate, revision, components, index, revisionIndex) => {
  cteateFormRow(form, fieldPath, tableTemplate, components, index, revisionIndex, rowNumber);
  createSubmissionRow(entityValue, previousValue, fieldPath, changes, revision, form);
  rowNumber = rowNumber + 1;
};

return createRow;
};

module.exports = (changelog, form, submission) => {
  if (changelog) {
    const rowNumber = 0;
    const createRow = setRowCount(rowNumber);
    const changeLogForm = [];

    const revisionData = changelog.map((revision, revisionIndex) => {
       const components = [
        {
          label: 'Outer Table',
          numRows: 1,
          cellAlignment: 'left',
          key: 'changeOuterLogTable',
          type: 'table',
          input: false,
          tableView: false,
          condensed: true,
          rows: []
        }
      ];
      const changes = {};
      const tableTemplate = {
        label: 'Table',
        numRows: 0,
        cellAlignment: 'left',
        key: 'changeLogTable',
        type: 'table',
        input: false,
        tableView: false,
        bordered: true,
        rows: []
      };
      revision.metadata.jsonPatch.forEach((change, index) => {
        if (Array.isArray(change.value)) {
          change.value.forEach((val, valIndex) => {
            if (val.value && val.path) {
              Object.assign(changes, {
                entityValue: val.value,
                previousValue: _.get(revision.metadata.previousData, `${val.path.slice(6).replace(/\//g, '.')}`),
                fieldPath: val.path.slice(6)
              });
            }
            else {
              Object.keys(val).forEach((entry, index) =>
                createRow(
                  val[entry],
                  _.get(revision.metadata.perviousData,`${change.path.slice(6).replace(/\//g, '.')}[${valIndex}]${entry}`),
                  `${change.path.slice(6)}/${valIndex}/${entry}`,
                  form,
                  changes,
                  tableTemplate,
                  revision,
                  components,
                  index,
                  revisionIndex
                  )
                );
            }
          });
        }
        else if (change.value && typeof change.value === 'object' && change.value.constructor.name !== 'Date') {
          _.forIn(change.value, (val, key) => {
              createRow(
                val,
                revision.data[change.path],
                `${change.path.slice(6)}/${key}`,
                form,
                changes,
                tableTemplate,
                revision,
                components,
                index,
                revisionIndex);
          });
        }
        else {
          const previousValue = _.get(revision.metadata.previousData, change.path.slice(6).replace(/\//g, '.'));
          if (previousValue && typeof previousValue === 'object' && !Array.isArray(previousValue) && previousValue.constructor.name !== 'Date') {
          _.forIn(previousValue, (val, key) =>
            createRow(
              change.op === "remove" ? '' : val,
              _.get(revision.metadata.previousData, `${change.path.slice(6).replace(/\//g, '.')}.${key}`),
              change.path.slice(6),
              form,
              changes,
              tableTemplate,
              revision,
              components,
              index,
              revisionIndex)
          );
          }
          else {
            return createRow(
                change.op === "remove" ? '' : change.value,
                previousValue,
                change.path.slice(6),
                form,
                changes,
                tableTemplate,
                revision,
                components,
                index,
                revisionIndex);
          }
        }
      });

      changeLogForm.push(...components);
      return changes;
    });

    form.components.push({
      legend: "Submission Change Log",
      key: "fieldSet",
      type: "fieldset",
      label: "Submission Change Log",
      input: false,
      tableView: false,
      components: changeLogForm
    });

    revisionData.forEach(revision => Object.assign(submission.data, revision));
  }
};
