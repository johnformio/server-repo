import { create, each } from 'lodash';
import { eachComponentData } from '../../../core-clean/lib/utils/formUtil';
import * as FormioCore from '@formio/core';
import { evaluateProcess } from '..';

FormioCore.ProcessTargets

const components = [
  {
    type: 'textfield',
    key: 'test',
    path: 'test',
    customDefaultValue: `value = instance.root.getComponent('container.test').dataValue`,
    // customDefaultValue: `value = instance.root.getComponent('parentTest[0]')._data.parentTest[0].test`,
  },
  {
    type: 'datagrid',
    // type: 'textfield',
    key: 'dataGrid',
    components: [{
      key: 'textField1',
      type: 'textfield',
    }]
  },
  {
    type: 'container',
    key: 'container',
    components: [{
      type: 'textfield',
      key: 'test',
    }]
  },
  {
    type: 'textfield',
    key: 'someText',
  }
];

const data = {
  parentTest: [
    {
      test: 'test',
    },
  ],
  container: {
    test: 'test',
  },
  someText: 'someText',
};

const processes = {
  customDefaultValue: [{...components[0]}],
}