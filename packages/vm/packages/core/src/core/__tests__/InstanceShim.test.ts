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

const dataGrid = {
    label: 'Data Grid',
    reorder: false,
    addAnotherPosition: 'bottom',
    layoutFixed: false,
    enableRowGroups: false,
    initEmpty: false,
    hideLabel: true,
    tableView: false,
    defaultValue: [
        {
            accountName: '',
            accountNumber: '',
            BillNoField: '',
        },
    ],
    validate: {
        maxLength: '15',
    },
    key: 'accountInfo',
    type: 'datagrid',
    defaultOpen: false,
    input: true,
    components: [
        {
            label: 'Using instance.rowIndex',
            applyMaskOn: 'change',
            tableView: true,
            validateOn: 'blur',
            validate: {
                required: true,
                custom: 'valid = isDup() ? "Duplicate detected" : true;\n\nfunction isDup() {\n    var cRow = instance.rowIndex;\n    if (data.accountInfo.length \u003E 1) {\n        for (var i = 0; i \u003C data.accountInfo.length; i++) {\n            if (i !== cRow && input === data.accountInfo[i].BillNoField) {\n                return true;\n            }\n        }\n        return false;\n    } else {\n        return false;\n    }\n}',
            },
            validateWhenHidden: false,
            key: 'BillNoField',
            type: 'textfield',
            input: true,
        },
        {
            label: 'Using rowIndex',
            applyMaskOn: 'change',
            tableView: true,
            validateOn: 'blur',
            validate: {
                required: true,
                custom: 'valid = isDup() ? "Duplicate detected" : true;\n\nfunction isDup() {\n    var cRow = rowIndex;\n    if (data.accountInfo.length \u003E 1) {\n        for (var i = 0; i \u003C data.accountInfo.length; i++) {\n            if (i !== cRow && input === data.accountInfo[i].BillNoField1) {\n                return true;\n            }\n        }\n        return false;\n    } else {\n        return false;\n    }\n}',
            },
            key: 'BillNoField1',
            type: 'textfield',
            input: true,
        },
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

    it('should add rowIndex property to the nested components', () => {
        const root = new RootShim(
            { components: [dataGrid] },
            {
                data: {
                    accountInfo: [
                        {
                            BillNoField: 'test',
                            BillNoField1: 'test2',
                        },
                        {
                            BillNoField: 'test3',
                            BillNoField1: 'test4',
                        },
                    ],
                    submit: true,
                },
            },
        );
        const instanceMap = root.instanceMap;
        const billNoFieldInstanceRow0 =
            instanceMap['accountInfo[0].BillNoField'];
        const billNoFieldInstanceRow1 =
            instanceMap['accountInfo[1].BillNoField'];
        expect(billNoFieldInstanceRow0.rowIndex).to.equal(0);
        expect(billNoFieldInstanceRow1.rowIndex).to.equal(1);
    });
});
