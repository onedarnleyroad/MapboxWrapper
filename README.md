# MapboxWrapper
Wrapper for mapbox-gl and mapbox.js, using a version as needed. 

## TODO

1. Write a less rubbish readme:
    1. Add Documentation on use
    2. Add better documentation on bundling in, 
    3. Add documentation on how to use the mapbox-gl test and load in bundles because IE11 seems to change with os

## Notes on use

This doesn't work in isolation, because we're not bundling in CSS or all the libraries it might use. For example 

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
