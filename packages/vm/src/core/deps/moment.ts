import fs from 'fs';

export const momentCode = fs.readFileSync('./node_modules/moment/min/moment.min.js', 'utf8');
