'use strict';
const path = require('path');
const JavaScriptObfuscator = require('webpack-obfuscator');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
module.exports = {
  mode: 'production',
  entry: './main.js',
  target: 'node',
  node: {
    __filename: true,
    __dirname: true,
    global: false
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'formio.js'
  },
  externals: [nodeExternals()],
  plugins: [
    new CopyWebpackPlugin({
      patterns:[
        {
          from:'./favicon.ico',
          to:'.'
        },
        {
          from:'./package.json',
          to:'.'
        },
        {
          from:'./yarn.lock',
          to:'.'
        }
      ]
    }),
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
      stringArrayEncoding: ['none'],
      stringArrayThreshold: 0.75,
      unicodeEscapeSequence: false
    })
  ]
};
