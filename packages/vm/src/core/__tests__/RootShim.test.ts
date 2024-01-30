import { expect } from 'chai';

describe('Test eachProcessedComponent', () => {
  return;
  const processes = {
    customDefaultValue: [{
      type: 'textfield',
      key: 'firstName',
      customDefaultValue: `value = 'John'`,
    }],
    validate: [
      {
        type: 'textfield',
        key: 'firstName',
        validate: {
          required: true,
        },
      },
      {
        type: 'textfield',
        key: 'lastName',
        validate: {
          required: true,
        },
      }
    ]
  };
});