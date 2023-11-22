import path from 'path';
import fs from 'fs';
const tableStr = fs.readFileSync(path.join(__dirname, '/table.html')).toString();
const valueStr = fs.readFileSync(path.join(__dirname, '/value.html')).toString();
const macros = `${tableStr}${valueStr}`.replace(/\n/g, '');
export default macros;
