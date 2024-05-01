import { expect } from 'chai';

import { evaluate } from '../evaluate';

describe('Test evaluate', () => {
    it('should evaluate simple code with lodash', async () => {
        const result = await evaluate({
            deps: ['lodash'],
            data: {},
            code: '_.camelCase("hello world")',
        });
        expect(result).to.equal('helloWorld');
    });

    it('should evaluate simple code with moment', async () => {
        const result = await evaluate({
            deps: ['moment'],
            data: {},
            code: 'moment(0).utc().format("YYYY-MM-DD")',
        });
        expect(result).to.equal('1970-01-01');
    });

    it('should evaluate simple code with core', async () => {
        const result = await evaluate({
            deps: ['core'],
            data: {},
            code: 'FormioCore.Utils.getComponentKey({ key: "textField", type: "textfield", input: true})',
        });
        expect(result).to.equal('textField');
    });

    it('should evaluate code with variables', async () => {
        const result = await evaluate({
            deps: [],
            data: {
                a: 1,
                b: 2,
            },
            code: 'a + b',
        });
        expect(result).to.equal(3);
    });

    it('should evaluate code with nested variables', async () => {
        const result = await evaluate({
            deps: [],
            data: {
                a: {
                    b: 1,
                },
                c: 2,
            },
            code: 'a.b + c',
        });
        expect(result).to.equal(3);
    });

    it('should evaluate code with nunjucks', async () => {
        const result = await evaluate({
            deps: ['nunjucks'],
            data: {},
            code: 'nunjucks.renderString("Hello {{ name }}", { name: "World" })',
        });
        expect(result).to.equal('Hello World');
    });

    it('should evaluate code with injectable dependencies', async () => {
        const result = await evaluate({
            deps: [],
            data: {},
            code: 'sum(1, 2)',
            additionalDeps: ['function sum(x, y) { return x + y }'],
        });
        expect(result).to.equal(3);
    });
});
