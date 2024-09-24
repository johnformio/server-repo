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

const components = [component1, component2, component3, component4];
const data = {
    firstName: 'John',
    lastName: 'Doe',
    email: '',
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
        const lastNameInstance =
            instanceMap.firstName.root.getComponent('lastName');
        expect(lastNameInstance.component).to.deep.equal(component2);
    });

    it('should get component not involved in processes', () => {
        // return;
        const someTextInstance =
            instanceMap.firstName.root.getComponent('someText');
        expect(someTextInstance.component).to.deep.equal(component4);
    });

    it('should expose a getCustomDefaultValue method', () => {
        const firstNameInstance = instanceMap.firstName;
        expect(firstNameInstance.getCustomDefaultValue()).to.equal('John');
    });
});
