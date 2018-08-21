'use strict';

var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var outputDir = 'build';

var nodeModules = {};
fs.readdirSync('node_modules')
  //.filter(function(x) {
  //  return ['.bin'].indexOf(x) === -1;
  //})
  .forEach(function(mod) {
    nodeModules[mod] = `commonjs ${mod}`;
  });

// Ensure build directory exists.
try {
  fs.mkdirSync(outputDir);
}
catch (e) {
  /* eslint-disable no-console */
  console.log('Destination build dir exists, skipping mkdir.');
  /* eslint-enable no-console */
}

// Copy over files
var copyFile = function(file) {
  fs.createReadStream(file).pipe(fs.createWriteStream(`${outputDir}/${file}`));
};
[
  'favicon.ico',
  'package.json',
  'package-lock.json'
].forEach(copyFile);

webpack({
  mode: 'production',
  entry: './main.js',
  target: 'node',
  node: {
    __filename: true,
    __dirname: true,
    module: true
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'main.js'
  },
  externals: nodeModules
}).run((err, stats) => {
  if (err) {
    /* eslint-disable no-console */
    console.err(err);
    return;
  }
  console.log('Finished compiling main.js.');
});
