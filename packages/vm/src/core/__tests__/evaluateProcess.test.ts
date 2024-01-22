import { expect } from 'chai';

import { evaluateProcess } from '../evaluateProcess';

const formWithNested = {
  components: [
    {
      type: 'container',
      key: 'container',
      components: [{
        type: 'textfield',
        key: 'textField1',
      }]
    },
    {
      type: 'datagrid',
      key: 'dataGrid',
      components: [{
        key: 'textField1',
        type: 'textfield',
      }]
    }
  ],
}

describe('Test evaluateProcess', () => {
  it('should evaluate customDefaultValue', async () => {
    const form = {
      components: [{
        type: 'textfield',
        key: 'firstName',
        customDefaultValue: `value = 'John'`,
      }],
    }
    const data = {};

    const result = await evaluateProcess({
      form,
      submission: { data },
    });

    expect(result.data).to.deep.equal({
        firstName: 'John',
    });
  });

  it('should evaluate simple validation', async () => {
    const form = {
      components: [
        {
          type: 'textfield',
          key: 'firstName',
          validate: {
            required: true,
          },
        },
      ],
    }
    const data = {};

    const result = await evaluateProcess({
      form,
      submission: { data },
    });

    expect(result.scope).to.have.property('errors');
    expect(result.scope.errors).to.have.lengthOf(1);
    expect(result.scope.errors[0].errorKeyOrMessage).to.be.equal('required');
    expect(result.scope.errors[0].level).to.be.equal('error');
    expect(result.scope.errors[0].context.path).to.be.equal('firstName');
  });


  it('should evaluate customDefaultValue with instance objects', async () => {
    const form = {
      components: [
        {
          type: 'textfield',
          key: 'test1',
        },
        {
          type: 'textfield',
          key: 'test2',
          customDefaultValue: `value = instance.root.getComponent('test1').dataValue`,
        },
      ],
    };
    const data = {
      test1: 'test',
    };
    const result = await evaluateProcess({
      form,
      submission: { data },
    });

    expect(result.data).to.deep.equal({
        test1: 'test',
        test2: 'test',
    });
  });

  it('should evaluate customDefaultValue with instance objects and container component', async () => {
    const data = {
      container: {
        textField1: 'test',
      },
    };
    const testComponent = {
      type: 'textfield',
      key: 'test',
      path: 'test',
      customDefaultValue: `value = instance.root.getComponent('container.textField1').dataValue`,
    };

    const result = await evaluateProcess({
      form: { ...formWithNested, components: [...formWithNested.components, testComponent] },
      // Note: Not working with data: {} 
      submission: { data },
    });
    expect(result.data).to.have.property('test').to.equal('test');
  });

  it('should evaluate customDefaultValue with instance objects and datagrid component', async () => {
    // return;
    const data = {
      dataGrid: [
        {
          textField1: 'test',
        }
      ]
    };
    const testComponent = {
      type: 'textfield',
      key: 'test',
      path: 'test',
      customDefaultValue: `value = instance.root.getComponent('dataGrid[0].textField1').dataValue`,
    };

    const result = await evaluateProcess({
      form: { ...formWithNested, components: [...formWithNested.components, testComponent] },
      // Note: Not working with data: {} 
      submission: { data },
    });
    expect(result.data).to.have.property('test').to.equal('test');
  });
});
