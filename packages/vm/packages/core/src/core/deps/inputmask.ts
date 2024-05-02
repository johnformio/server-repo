import fs from 'fs';
import path from 'path';

export const inputmaskCode = fs.readFileSync(
    path.join(__dirname, './assets/inputmask.min.js'),
    'utf8',
);
