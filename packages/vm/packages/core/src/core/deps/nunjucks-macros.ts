import path from 'path';
import fs from 'fs';
let macros = fs.readFileSync(path.join(__dirname, './assets/table.html')).toString();
macros += fs.readFileSync(path.join(__dirname, './assets/value.html')).toString();
export default macros.replace(/\n/g, '');
