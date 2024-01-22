import path from 'path';
import fs from 'fs';
let macros = fs.readFileSync(path.join(__dirname, '/table.html')).toString();
macros += fs.readFileSync(path.join(__dirname, '/value.html')).toString();
export default macros.replace(/\n/g, '');
