import { Component, TextAreaComponent, ValidationContext } from 'types';
import { expect } from 'chai';

import { isEligible, emptyValueIsArray, validateMultipleSync } from '../validateMultiple';
import { FieldError } from 'error';

describe('validateMultiple', () => {
    describe('isEligible', () => {
        it('should return false for hidden component with multiple', () => {
            const component: Component = {
                type: 'hidden',
                input: true,
                key: 'hidden',
            };
            expect(isEligible(component)).to.be.false;
        });

        it('should return false for address component if not multiple', () => {
            const component: Component = {
                type: 'address',
                input: true,
                key: 'address',
            };
            expect(isEligible(component)).to.be.false;
        });

        it('should return true for address component if multiple', () => {
            const component: Component = {
                type: 'address',
                input: true,
                key: 'address',
                multiple: true,
            };
            expect(isEligible(component)).to.be.true;
        });

        it('should return false for textArea component with as !== json', () => {
            const component: TextAreaComponent = {
                type: 'textArea',
                as: 'text',
                input: true,
                key: 'textArea',
                multiple: true,
                rows: 4,
                wysiwyg: true,
                editor: 'ckeditor',
                fixedSize: true,
                inputFormat: 'plain',
            };
            expect(isEligible(component)).to.be.false;
        });

        it('should return true for textArea component with as === json', () => {
            const component: TextAreaComponent = {
                type: 'textArea',
                as: 'json',
                input: true,
                key: 'textAreaJson',
                multiple: true,
                rows: 4,
                wysiwyg: true,
                editor: 'ckeditor',
                fixedSize: true,
                inputFormat: 'plain',
            };
            expect(isEligible(component)).to.be.true;
        });

        it('should return true for other component types', () => {
            const component: Component = {
                type: 'textfield',
                input: true,
                key: 'textfield',
                multiple: true,
            };
            expect(isEligible(component)).to.be.true;
        });
    });

    describe('emptyValueIsArray', () => {
        it('should return true for datagrid component', () => {
            const component: Component = {
                type: 'datagrid',
                input: true,
                key: 'datagrid',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for editgrid component', () => {
            const component: Component = {
                type: 'editgrid',
                input: true,
                key: 'editgrid',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for tagpad component', () => {
            const component: Component = {
                type: 'tagpad',
                input: true,
                key: 'tagpad',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for sketchpad component', () => {
            const component: Component = {
                type: 'sketchpad',
                input: true,
                key: 'sketchpad',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for datatable component', () => {
            const component: Component = {
                type: 'datatable',
                input: true,
                key: 'datatable',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for dynamicWizard component', () => {
            const component: Component = {
                type: 'dynamicWizard',
                input: true,
                key: 'dynamicWizard',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for file component', () => {
            const component: Component = {
                type: 'file',
                input: true,
                key: 'file',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return false for select component without multiple', () => {
            const component: Component = {
                type: 'select',
                input: true,
                key: 'select',
            };
            expect(emptyValueIsArray(component)).to.be.false;
        });

        it('should return true for select component with multiple', () => {
            const component: Component = {
                type: 'select',
                input: true,
                key: 'select',
                multiple: true,
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return true for tags component with storeas !== string', () => {
            const component: Component = {
                type: 'tags',
                input: true,
                key: 'tags',
                storeas: 'array',
            };
            expect(emptyValueIsArray(component)).to.be.true;
        });

        it('should return false for tags component with storeas === string', () => {
            const component: Component = {
                type: 'tags',
                input: true,
                key: 'tags',
                storeas: 'string',
            };
            expect(emptyValueIsArray(component)).to.be.false;
        });

        it('should return false for other component types', () => {
            const component: Component = {
                type: 'textfield',
                input: true,
                key: 'textfield',
            };
            expect(emptyValueIsArray(component)).to.be.false;
        });
    });

    describe('validateMultipleSync', () => {
        describe('values that should be arrays', () => {
            // TODO: skipping the following tests until we can resolve whether or not we want to validateMultiple on select components
            xit('should return an error for a select component with multiple that is not an array', () => {
                const component: Component = {
                    type: 'select',
                    input: true,
                    key: 'select',
                    multiple: true,
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        select: 'foo',
                    },
                    value: 'foo',
                    row: {
                        select: 'foo'
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.instanceOf(FieldError);
            });

            xit('should return null for a select component with multiple that is an array', () => {
                const component: Component = {
                    type: 'select',
                    input: true,
                    key: 'select',
                    multiple: true,
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        select: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        select: 'foo'
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });

            xit('should return an error for a select component without multiple that is an array', () => {
                const component: Component = {
                    type: 'select',
                    input: true,
                    key: 'select',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        select: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        select: ['foo']
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.instanceOf(FieldError);
            });

            xit('should return null for a select component without multiple that is not an array', () => {
                const component: Component = {
                    type: 'select',
                    input: true,
                    key: 'select',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        select: 'foo',
                    },
                    value: 'foo',
                    row: {
                        select: 'foo'
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });

            it('should not validate a select component with multiple', () => {
                const component: Component = {
                    type: 'select',
                    input: true,
                    key: 'select',
                    multiple: true,
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        select: ['foo', 'bar'],
                    },
                    value: ['foo', 'bar'],
                    row: {
                        select: ['foo', 'bar'],
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });

            it('should return null for a sketchpad component', () => {
                const component: Component = {
                    type: 'sketchpad',
                    input: true,
                    key: 'sketchpad',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        sketchpad: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        sketchpad: ['foo']
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });

            it('should return null for a tagpad component', () => {
                const component: Component = {
                    type: 'sketchpad',
                    input: true,
                    key: 'tagpad',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        tagpad: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        tagpad: ['foo']
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });

            it('should return null for a data table component', () => {
                const component: Component = {
                    type: 'datatable',
                    input: true,
                    key: 'datatable',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        [component.key]: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        [component.key]: ['foo']
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });

            it('should return null for a dynamic wizard component', () => {
                const component: Component = {
                    type: 'dynamicWizard',
                    input: true,
                    key: 'dynamicwizard',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        [component.key]: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        [component.key]: ['foo']
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.null;
            });
        });

        describe('values that should not be arrays', () => {
            it('should return an error for a textfield component without multiple that is an array', () => {
                const component: Component = {
                    type: 'textfield',
                    input: true,
                    key: 'textfield',
                };
                const context: ValidationContext = {
                    component,
                    data: {
                        textfield: ['foo'],
                    },
                    value: ['foo'],
                    row: {
                        textfield: ['foo']
                    },
                    scope: {
                        errors: []
                    },
                    path: component.key
                };
                expect(validateMultipleSync(context)).to.be.instanceOf(FieldError);
            });
        });
    });
});
