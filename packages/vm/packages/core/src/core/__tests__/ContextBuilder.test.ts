import { expect } from 'chai';
import ContextBuilder from '../ContextBuilder';
import { Context } from 'isolated-vm';

describe('Test ContextBuilder', () => {
    let context: Context = null as any;
    it('should create context with dependecies', async () => {
        context = await ContextBuilder.fromDefaultIsolate()
            .withLodash()
            .withMoment()
            .withCore()
            .withNunjucks()
            .build();

        expect(context).to.be.an('object');
        expect(context).to.have.property('evalSync');
    });

    it('should evaluate lodash', () => {
        const result = context.evalSync('_.camelCase("hello world")');
        expect(result).to.equal('helloWorld');
    });

    it('should evaluate moment', () => {
        const result = context.evalSync('moment(0).utc().format("YYYY-MM-DD")');
        expect(result).to.equal('1970-01-01');
    });

    it('should evaluate core', () => {
        const result = context.evalSync(
            'FormioCore.Utils.getComponentKey({ key: "textField", type: "textfield", input: true})',
        );
        expect(result).to.equal('textField');
    });

    it('should evaluate code with nunjucks', () => {
        const result = context.evalSync(
            'nunjucks.renderString("Hello {{ name }}", { name: "World" })',
        );
        expect(result).to.equal('Hello World');
    });

    it(`should evaluate code with nunjucks['lib']`, () => {
        const result = context.evalSync(
            `var nlib = nunjucks["lib"]; var date = moment.utc('2024-08-01T13:03:26.208Z'); nlib.isFunction(date['add']);`,
        );
        expect(result).to.equal(true);
    });

    it('should evaluate code with injectable depencies', () => {
        const context = ContextBuilder.fromDefaultIsolate()
            .withInjectedDependency('function sum(x, y) { return x + y }')
            .buildSync();
        const result = context.evalSync('sum(1, 2)');
        expect(result).to.equal(3);
    });
});
