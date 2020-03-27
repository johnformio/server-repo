'use strict';

var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = (app) => {
  return new Promise((resolve, reject) => {
    // Turn on or off optiminizations and obfuscation.
    const mode = process.env.MODULE_DEV === 'true' ? 'development' : 'production';
    const plugins = mode === 'production' ? [
      // Low obfuscation, High performance options.
      new JavaScriptObfuscator({
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        debugProtectionInterval: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        renameGlobals: false,
        rotateStringArray: true,
        selfDefending: true,
        shuffleStringArray: true,
        splitStrings: false,
        stringArray: true,
        stringArrayEncoding: false,
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false
      })
    ] : [];
    console.log('\nCompiling external modules.');
    webpack({
      mode,
      entry: path.resolve(__dirname, '../modules/index.js'),
      target: 'web',
      output: {
        library: 'externalModules',
        libraryTarget: 'umd',
        libraryExport: 'default',
        path: path.resolve(process.cwd(), 'portal'),
        filename: 'externalModules.js'
      },
      plugins,
      externals: {
        formiojs: 'Formio'
      }
    }).run((err, stats) => {
      if (err) {
        /* eslint-disable no-console */
        console.log(' > Error compiling modules.');
        console.error(err);
        return reject(err);
      }
      console.log(' > Finished compiling modules.');
      return resolve();
    });
  });
};
