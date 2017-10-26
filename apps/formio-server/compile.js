'use strict';

var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var UglifyJS = require('uglify-es');
var outputDir = 'build';

var nodeModules = {};
fs.readdirSync('node_modules')
  //.filter(function(x) {
  //  return ['.bin'].indexOf(x) === -1;
  //})
  .forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
  });

// Ensure build directory exists.
try {
  fs.mkdirSync(outputDir);
}
catch (e) {
  /* eslint-disable no-console */
  console.error(e);
  /* eslint-enable no-console */
}

// Copy over files
var copyFile = function(file) {
  fs.createReadStream(file).pipe(fs.createWriteStream(outputDir + '/' + file));
};
[
  'favicon.ico',
  'package.json'
].forEach(copyFile);

var compiler = webpack({
  entry: './main.js',
  target: 'node',
  node: {
    __filename: true,
    __dirname: true,
    module: true
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'main.js'
  },
  externals: nodeModules
});

compiler.run(function(err, stats) {
  var code = UglifyJS.minify(fs.readFileSync("build/main.js", "utf8"), {
    mangle: {
      reserved: [
        '__filename',
        '__dirname',
        'module'
      ]
    }
  }).code;

  fs.writeFile('build/main.js', code);
});
