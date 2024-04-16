import { expect } from 'chai';
import { RootShim } from '../RootShim';
import { InstanceShim } from '../InstanceShim';

describe('getComponent', () => {
    it('should return a component (InstanceShim) at an exact path if it exists', () => {
        const components = [
            {
                type: 'textfield',
                key: 'textfield',
                label: 'Text Field',
                input: true,
            },
        ];
        const root = new RootShim({ components }, { data: {} });
        const component = root.getComponent('textfield');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textfield');
    });

    it('should return a component at an exact nested path if it exists', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim(
            { components },
            { data: { dataGrid: [{ textField: 'hello' }] } },
        );
        const component = root.getComponent('dataGrid[0].textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
    });

    it('should return a component at an exact path if it exists and there is no data associated with that component', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim({ components }, { data: {} });
        const component = root.getComponent('dataGrid[0].textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
        expect(component.component.label).to.be.equal('Text Field');
    });

    it('should return a component (InstanceShim) at a path with the final pathname segment matching the path argument if it exists', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim(
            { components },
            { data: { dataGrid: [{ textField: 'hello' }] } },
        );
        const component = root.getComponent('textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
    });

    it('should return a component (InstanceShim) at a path with the final pathname segment matching the path argument if it exists and there is no data associated with the component', () => {
        const components = [
            {
                type: 'datagrid',
                key: 'dataGrid',
                components: [
                    {
                        type: 'textfield',
                        key: 'textField',
                        label: 'Text Field',
                        input: true,
                    },
                ],
            },
        ];
        const root = new RootShim({ components }, { data: {} });
        const component = root.getComponent('textField');
        expect(component).to.be.instanceOf(InstanceShim);
        expect(component.component.key).to.be.equal('textField');
        expect(component.component.label).to.be.equal('Text Field');
    });
});
