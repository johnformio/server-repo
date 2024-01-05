import { expect } from 'chai';

import evaluate from '../evaluate';

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
      code: 'moment(0).format("YYYY-MM-DD")',
    });
    expect(result).to.equal('1970-01-01');
  });

  it('should evaluate simple code with core', async () => {
    const result = await evaluate({
      deps: ['core'],
      data: {},
      code: 'FormioCore.isEmpty(null)',
    });
    expect(result).to.equal(true);
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
});