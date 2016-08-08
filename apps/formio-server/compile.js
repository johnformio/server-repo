'use strict';

var fs = require('fs');
var path = require('path');
var NodeOptimizer = require('node-optimize');
var UglifyJS = require('uglify-js');

var outputDir = 'build';

// Ensure build directory exists.
try {
  fs.mkdirSync(outputDir);
}
catch (e) {
  // Do nothing
}

// Copy over files
var copyFile = function(file) {
  fs.createReadStream(file).pipe(fs.createWriteStream(outputDir + '/' + file));
};
[
  'favicon.ico',
  'package.json',
  'project.json',
  'server.sh'
].forEach(copyFile);

var optimizer = new NodeOptimizer({
  ignore: [],
  // Include dynamically required files.
  include: [
    './src/db/updates'
  ]
});

var mergedJs = optimizer.merge('main.js');

// compress and mangle the result
var toplevelAst = UglifyJS.parse(mergedJs);
toplevelAst.figure_out_scope();

/* eslint-disable new-cap */
var compressor = UglifyJS.Compressor();
var compressedAst = toplevelAst.transform(compressor);

compressedAst.figure_out_scope();
compressedAst.compute_char_frequency();
compressedAst.mangle_names();

var stream = UglifyJS.OutputStream();
compressedAst.print(stream);

stream = stream.toString().replace(new RegExp(__dirname, 'gi'), '');

fs.writeFile(path.resolve(outputDir + '/server.js'), stream);
