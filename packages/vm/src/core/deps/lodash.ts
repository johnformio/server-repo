import fs from 'fs';
import path from 'path';

export const lodashCode = fs.readFileSync(path.join(__dirname, './assets/lodash.min.js'), 'utf8');
