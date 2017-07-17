
var dest = __dirname + "/dist/MapboxWrapper.js";
var src = "./src/index.js";

var browserify = require('browserify');
var fs = require('fs');
var b = browserify({
    standalone: 'MapboxWrapper'
});

var outputFs = fs.createWriteStream( dest );

b.add( src );
b.bundle().pipe( outputFs );

outputFs.on('finish', function () {
    console.log('Finished building: ' + dest);
    process.exit();
});
