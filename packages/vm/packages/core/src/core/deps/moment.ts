import fs from 'fs';
import path from 'path';

export const momentCode = fs.readFileSync(path.join(__dirname, './assets/moment.min.js'), 'utf8');
