# MapboxWrapper
Wrapper for mapbox-gl and mapbox.js, using a version as needed. 

## TODO

1. Write a less rubbish readme:
    1. Add Documentation on use
    2. Add better documentation on bundling in, 
    3. Add documentation on how to use the mapbox-gl test and load in bundles because IE11 seems to change with os

## Notes on use

This doesn't work in isolation, because we're not bundling in CSS or all the libraries it might use. You are responsible for including packages manually, but they are dependencies in this package.

This is because you probably don't want a bundle that has both GL and Leaflet versions in one, and want to require different bundles depending on...whatever. On top of this, the gl check that is bundled with mapbox-gl is broken on some versions of IE (we've found Windows 8.1 from some tests on browserstack), as such we have to include the check as a seperate file that is run *before* mapbox-gl is executed in the browser. As frustrating as that is, it's actually somewhat beneficial to load mapbox-gl in separately only when you need it, because it's around 500kb and so will slow page load when it's not necessary.

Note that mapbox.js, in NPM, doesn't come with a built version, so either needs to be built, or used with browserify, or included from a CDN.

To perform the GL check, include `./node_modules/mapbox-gl-supported/index.js`

GL just requires `/node_modules/mapbox-gl/dist/mapbox-gl.js' to run.

Mapbox.js requires `mapbox.js` and `./node_modules/leaflet.markercluster/dist/leaflet.markercluster.js` for clustering.

Supercluster is built into the wrapper already, because it's more likely you use GL.




### Checking functionality:

Example using loadJS. Assumes jQuery is ready to go here. IE11 can evaluate true if you just bundle in mapbox-gl so use mapbox-gl-supported, bundle that in with jquery and load js and run the following (for example):

```

var config = {
    // my mapbox config
}

var myLeafletBundle = '/path/to/leafletBundle.js';
var myGlBundle = '/path/to/myGlBundle.js';

if (mapboxgl.supported()) {
    var bundle = myGlBundle;
    var forceMapType = 'mapbox-gl';
} else {
    var bundle = myLeafletBundle;
    var forceMapType = 'leaflet';
}

loadjs([ bundle ], 'mapbox');
loadjs.ready('mapbox', {
    success: function() {
        var wrapper = new MapboxWrapper( $.extend({}, config, {
            type: forceMapType
        } );         
    }
});


```

## Building

Dist should be built with the repo, but build it yourself with 

`npm run build`

## Bundling with scriptfiles:

`./node_modules/mapboxwrapper/dist/MapboxWrapper.js`

## Use as a module:

In theory should just work with `require('mapboxwrapper')` but I haven't tested this.
