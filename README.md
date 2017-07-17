# MapboxWrapper
Wrapper for mapbox-gl and mapbox.js, using a version as needed. 

## TODO

1. Write a less rubbish readme:
    1. Add Documentation on use
    2. Add better documentation on bundling in, 
    3. Add documentation on how to use the mapbox-gl test and load in bundles because IE11 seems to change with os

## Notes on use

Assumes jquery and `$` is in the global object, so this will fail if you don't load jquery in first or as part of the same bundle of javascript. This is just the way we work, so it's okay!

This doesn't work in isolation, because we're not bundling in CSS or all the libraries it might use. You are responsible for including packages manually, but they are dependencies in this package.

This is because you probably don't want a bundle that has both GL and Leaflet versions in one, and want to require different bundles depending on...whatever. On top of this, the gl check that is bundled with mapbox-gl is broken on some versions of IE (we've found Windows 8.1 from some tests on browserstack), as such we have to include the check as a seperate file that is run *before* mapbox-gl is executed in the browser. As frustrating as that is, it's actually somewhat beneficial to load mapbox-gl in separately only when you need it, because it's around 500kb and so will slow page load when it's not necessary.

Note that mapbox.js, in NPM, doesn't come with a built version, so either needs to be built, or used with browserify, or included from a CDN.

To perform the GL check, include `./node_modules/mapbox-gl-supported/index.js`

GL just requires `/node_modules/mapbox-gl/dist/mapbox-gl.js' to run.

Mapbox.js requires `mapbox.js` and `./node_modules/leaflet.markercluster/dist/leaflet.markercluster.js` for clustering.

Supercluster is built into the wrapper already, because it's more likely you use GL.

## Using the functions:

### Create a map


Firstly - configure your Mapbox options, refer to both libraries, if you intend to fallback, as the properties and names sometimes differ, but pass in any properties that are expected / used in mapbox:
https://www.mapbox.com/mapbox-gl-js/api/#map
https://www.mapbox.com/mapbox.js/api/v3.1.1/l-mapbox-map/

There are also some custom properties that are very important due to the opinionated way the wrapper works:

```

var options = {
    // add your mapbox options first eg center: [50, 0]

    // Add your access token here:
    accessToken: 'myAccessToken'

    // Force leaflet type here:
    type: 'leaflet',

    // or force mapbox-gl here:
    type: 'mapbox-gl',

    // Add an onload event if you want one.
    // This is important here, rather than later, because the leaflet version is
    // fickle about when this is registered. So pass it in here:
    onLoad: function() {
        // map is ready.
        // eg: $map.addClass('ready');
    }
};

// Create the map:
var myWrapper = new MapboxWrapper( options );

```

If you do not pass in the `type` property, it will attempt to perform `mapboxgl.supported()` but this will assume
that the mapbox gl and leaflet versions are bundled in. This is a bit of a pointless implementation now, because of Internet Explorer 11 and the supported bug, but there you go. It does mean if you are confident you want to use GL for those that support it, and don't care about the 11 issues (i.e. it's a small subset of 11) then you don't have to worry about leaflet, and can just bundle together and run. 

`myWrapper` now has a bunch of methods and properties, many of which mimic mapbox-gl:

### Properties:

`wrapper.type`
Will be either `leaflet` or `mapbox-gl`. You can pass this in yourself, as above, but if you don't, this will be set to GL if the browser passes the `supported()` test, or leaflet otherwise. 

`wrapper.map` 
This is the mapbox instance. It will either be a mapbox.js instance, or a mapbox-gl instance. As such, you can ignore all the wrapper functions and access the map directly.

### Methods mimicking mapbox-gl:

_See mapbox documentation for these:_
`wrapper.getZoom`
`wrapper.getMinZoom`
`wrapper.getMaxZoom`
`wrapper.getCenter`
`wrapper.flyTo( options )`
`wrapper.zoomTo( options )`

### Other methods:

#### `wrapper.updateConfig( prop, value )`
Change a config value. Useful for changing max or min zoom on the fly. That's actually about it for now, as the other
options may not be set.

#### `wrapper.addMarker( coords, data, template )`

Add a marker, with `coords`, `data` being information passed to `template`. Template should be an instance of `twig.js` as `template.render( data )` will be called. Generally this method isn't really needed as you can use the markers or clusters option.


#### `wrapper.addMarkers( options )`

Uses the `MapboxMarkers` function to streamline adding multiple markers to a map:

```
var markers = wrapper.addMarkers( options );

```

Available Options:

`options.locations`
An array of objects with data on the marker (that you may use however, but usually for templating the marker HTML) and
locations, eg:

```
[{
    "location":["1.30151920","38.98263570"],
    "title": "My Marker",
    "customProp": "My Custom Prop Value"
},
{
    // etc
},]
```

`options.addClass`
Add a css class name to the mapbox HTML element that is rendered.

`options.template`
Assumes a 1dr templating template (our twig.js wrapper) but basically calls this:
`template.render( markerData )`

in other words,  each object's properties in the `options.locations` array will be applied as markerData to
the template.render function. So you could fake a different templating function.

`options.onClick'
Pass a function callback for the marker click eg:

```
{
    onClick: function( e ) {
        // `this` is the mapbox Marker object
        // e is the event data
    }
}
```

`options.elementCallback`
Pass a function callback when the element is rendered on the map. This is a one time 'just after it's added' function
so you can use this instead of templating, or on click or whatever eg:

```
{
    elementCallback: function( marker, $el, markerData ) {
        // marker -> Mapbox marker
        // markerData -> the particular object from the locations array
        // $el - jquery element of the marker added to mapbox.
    }
}
```



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
