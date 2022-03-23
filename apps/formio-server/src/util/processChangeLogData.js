'use strict';
const _ = require('lodash');

const setRowCount = (rowNumber) => {
const addComponentToTable = (component, tableTemplate, components, index, revisionIndex, isInitialSubmission) => {
  let valueComponent;
  if (revisionIndex === 0 && !component.label.endsWith('&Delta;') && !isInitialSubmission) {
   component.label = `${component.label} &Delta;`;
  }
  if (!['signature', 'sketchpad', 'datetime', 'time', 'currency', 'select', 'radio'].includes(component.type)) {
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

  if (index === 0) {
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

    components[0].rows.push(outerTemplate);
    components[0].numRows = components[0].rows.length;
  }
};

const cteateFormRow = (form, fieldPath, tableTemplate, components, index, revisionIndex, isInitialSubmission) => {
  const pathArr = fieldPath.split('/');

  pathArr.reduce((prev, current)=> {
     let formComponent;
     if (Array.isArray(prev)) {
      formComponent = prev.find(component=>component.key && component.key === current) || prev;
     }
     else if (prev && prev.key && prev.key === current) {
      formComponent = prev;
     }
     else {
       return;
     }

     if (formComponent && formComponent.key === current) {
       if (formComponent.components) {
        return formComponent.components;
       }
       else {
        addComponentToTable(formComponent, tableTemplate, components, index, revisionIndex, isInitialSubmission);
       }
     }
     else {
       return formComponent;
     }
       return;
    }, form.components);
};

const updatePath = (path, formComponents) => {
  const pathArr = path.split('/');
  const normalizeLabel = (str) => str.endsWith('&Delta;') ? str.slice(0, str.length-7) : str;
  let prevElement;
  const pathLabel = pathArr.map(key => {
    // eslint-disable-next-line no-undef
    const element = FormioUtils.getComponent(formComponents, key);
    if (element && element.label) {
      if (element.components || element.values) {
        prevElement = element;
      }
      return normalizeLabel(element.label);
    }
    else {
      if (prevElement) {
        // eslint-disable-next-line no-undef
        const innerElement = prevElement.components ? FormioUtils.getComponent(prevElement.components, key) : prevElement.values.find(element=>element.value === key);
        return normalizeLabel(innerElement && innerElement.label ? innerElement.label : key);
      }
      else {
        return key;
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
  [`entityValue${rowNumber}`]: entityValue.toString(),
  [`previousValue${rowNumber}`]: previousValue.toString(),
  [`fieldPath${rowNumber}`]:updatePath(fieldPath, form.components)
});
};

const createRow = (entityValue, previousValue, fieldPath, form, changes, tableTemplate, revision, components, index, revisionIndex, isInitialSubmission) => {
  cteateFormRow(form, fieldPath, tableTemplate, components, index, revisionIndex, isInitialSubmission);
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
                  valIndex,
                  revisionIndex,
                  !revision.metadata.previousData
                  )
                );
            }
          });
        }
        else if (change.value && typeof change.value === 'object' && change.value.constructor.name !== 'Date') {
          let i = index;
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
                i,
                revisionIndex,
                !revision.metadata.previousData);
                i++;
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
              revisionIndex,
              !revision.metadata.previousData)
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
                revisionIndex,
                !revision.metadata.previousData);
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
