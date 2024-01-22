import fs from 'fs';

export const lodashCode = fs.readFileSync('./node_modules/lodash/lodash.min.js', 'utf8');
