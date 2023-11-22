import { evaluateInVm } from './evaluateInVm';

const result = evaluateInVm(
    `const fs = require('fs'); result = fs.readFileSync('/Users/brendanjbond/Desktop/hello.txt'); result;`,
    { result: null, require },
    {},
    'result',
    { timeout: 250 }
);

console.log(result);
