import { expect } from 'chai';
import ContextBuilder from '../ContextBuider';
import { Context } from 'isolated-vm';
import * as core from '@formio/core'

describe('Test ContextBuilder', () => {
  let context: Context = null as any;
  it('should create context with dependecies', async () => {
    context = await ContextBuilder
      .fromDefaultIsolate()
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
    const result = context.evalSync('moment(0).format("YYYY-MM-DD")');
    expect(result).to.equal('1970-01-01');
  });

  it('should evaluate core', () => {
    const result = context.evalSync('FormioCore.isEmpty(null)');
    expect(result).to.equal(true);
  });

  it('should evaluate code with nunjucks', () => {
    const result = context.evalSync('nunjucks.renderString("Hello {{ name }}", { name: "World" })');
    expect(result).to.equal('Hello World');
  });
});
