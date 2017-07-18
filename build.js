
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






// Build mapbox.js

var l = browserify({
    standalone: 'L'
});

var loutputFs = fs.createWriteStream( __dirname + "/dist/mapbox.js" );

l.add( './node_modules/mapbox.js/src/index.js' );
l.bundle().pipe( loutputFs );




var p1 = new Promise(function( res, rej ) {
    outputFs.on('finish', function () {
        console.log('Finished building: ' + dest);
        res();
    });
});

var p2 = new Promise(function( res, rej ) {
    loutputFs.on('finish', function () {
        console.log('Finished building: mapbox.js');
        res();
    });
});


Promise.all([p1,p2]).then(function() {
    console.log("Built everything, exiting...");
    process.exit();
});
