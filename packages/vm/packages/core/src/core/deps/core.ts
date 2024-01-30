import fs from 'fs';

export const coreCode = fs.readFileSync('./node_modules/@formio/core/dist/formio.core.min.js', 'utf8');
export const polyfillCode = `
var Text              = class {};
var HTMLElement       = class {};
var HTMLCanvasElement = class {};
var navigator         = {userAgent: ''};
var document          = {
  createElement: () => ({}),
  cookie: '',
  getElementsByTagName: () => [],
  documentElement: {
    style: [],
    firstElementChild: {appendChild: () => {}}
  }
};
var window = {addEventListener: () => {}, Event: function() {}, navigator: global.navigator};
var btoa = (str) => {
  return (str instanceof Buffer) ?
    str.toString('base64') :
    Buffer.from(str.toString(), 'binary').toString('base64');
};
//var setTimeout = () => {};
var self = global;
`;
export const aliasesCode = `
util = FormioCore.Utils;

// jsonLogic = util.jsonLogic;
`;
