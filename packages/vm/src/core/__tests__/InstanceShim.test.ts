import { expect } from 'chai';
import { RootShim } from '../RootShim';

const component1 = {
  type: 'textfield',
  key: 'firstName',
  customDefaultValue: `value = 'John'`,
};

const component2 = {
  type: 'textfield',
  key: 'lastName',
  validate: {
    required: true,
  },
};

const component3 = {
  type: 'textfield',
  key: 'email',
  validate: {
    required: true,
  },
};

const component4 = {
  type: 'textfield',
  key: 'someText',
};

const components = [
  component1,
  component2,
  component3,
  component4,
];
const data = {
  firstName: 'John',
  lastName: 'Doe',
  email: '',
};
const processes = {
  customDefaultValue: [
    component1,
  ],
  validate: [
    component2,
    component3,
  ],
};

describe('Test InstanceShim', () => {
  const root = new RootShim({ components }, { data });
  const instanceMap = root.instanceMap;

  it('should create an instance map', () => {
    expect(instanceMap).to.have.property('firstName');
    expect(instanceMap).to.have.property('lastName');
    expect(instanceMap).to.have.property('email');
  });

  it('should get root from instance', () => {
    expect(instanceMap.firstName).to.have.property('root');
    expect(instanceMap.firstName.root).to.have.property('getComponent');
  });

  it('should get component from root', () => {
    // return;
    const lastNameInstance = instanceMap.firstName.root.getComponent('lastName');
    expect(lastNameInstance.component).to.deep.equal(component2);
  });

  it('should get component not involved in processes', () => {
    // return;
    const someTextInstance = instanceMap.firstName.root.getComponent('someText');
    expect(someTextInstance.component).to.deep.equal(component4);
  });

  it('test', () => {
    const components = [
      {
        type: 'editgrid',
        // type: 'textfield',
        key: 'parentTest',
        components: [{
          key: 'test',
          type: 'textfield',
        }]
      },
      {
        type: 'textfield',
        key: 'testKeyValue',
        customDefaultValue: `value = instance.root.getComponent('parentTest.test').dataValue`,
      },
    ];
    const data = {
      parentTest: [
        {
          test: 'test',
        },
      ],
      testKeyValue: '',
    };
    const processes = {
      customDefaultValue: [{
        type: 'textfield',
        key: 'testKeyValue',
        customDefaultValue: `value = instance.root.getComponent('parentTest.test').dataValue`,
      }]
    };

    // const instanceMap = createInstanceMap(processes, components, data);
  })
});