# MapboxWrapper

Wrapper for mapbox-gl and mapbox.js, using a version as needed. 

# TODO

1. Write a less rubbish readme:
    1. Add Documentation on use
    2. Add better documentation on bundling in, 
    3. Add documentation on how to use the mapbox-gl test and load in bundles because IE11 seems to change with os

# Notes on use

Assumes jquery and `$` is in the global object, so this will fail if you don't load jquery in first or as part of the same bundle of javascript. This is just the way we work, so it's okay!

This doesn't work in isolation, because we're not bundling in CSS or all the libraries it might use. You are responsible for including packages manually, but they are dependencies in this package.

This is because you probably don't want a bundle that has both GL and Leaflet versions in one, and want to require different bundles depending on...whatever. On top of this, the gl check that is bundled with mapbox-gl is broken on some versions of IE (we've found Windows 8.1 from some tests on browserstack), as such we have to include the check as a seperate file that is run *before* mapbox-gl is executed in the browser. As frustrating as that is, it's actually somewhat beneficial to load mapbox-gl in separately only when you need it, because it's around 500kb and so will slow page load when it's not necessary.

Note that mapbox.js, in NPM, doesn't come with a built version, so either needs to be built, or used with browserify, or included from a CDN.

To perform the GL check, include `./node_modules/mapbox-gl-supported/index.js`

GL just requires `/node_modules/mapbox-gl/dist/mapbox-gl.js' to run.

Mapbox.js requires `mapbox.js` and `./node_modules/leaflet.markercluster/dist/leaflet.markercluster.js` for clustering.

Supercluster is built into the wrapper already, because it's more likely you use GL.

# Usage:

## Create / initialise a map


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

## Instance Properties:

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

### Helper methods:

#### `wrapper.updateConfig( prop, value )`
Change a config value. Useful for changing max or min zoom on the fly. That's actually about it for now, as the other
options may not be set.

#### `wrapper.addMarker( coords, data, template )`

Add a marker, with `coords`, `data` being information passed to `template`. Template should be an instance of `twig.js` as `template.render( data )` will be called. Generally this method isn't really needed as you can use the markers or clusters option.


# Adding Multiple Markers


Add a set of markers en masse. If you want to use clustering, do not use this, use `addClusters` below.

```
var markers = wrapper.addMarkers( options );
```

The markers object is simplistic, and does not work in quite as an advanced way as the clusters object. in the example above the returned `markers` object will have a couple of methods for adding markers and plotting, but they're not very useful because they don't update the internal marker store. If you need to keep adding and removing markers dynamically, but you _don't_ want clustering, then this function needs a little bit of work.


## Options:


### `options.locations`
An array of objects with a lat long array, and arbitrary data for each HTML marker (that you may use however you need, but usually for templating the marker HTML) and
locations, eg:

```
[
	{
    	"location":["1.30151920","38.98263570"],
	    "title": "My Marker",
    	"customProp": "My Custom Prop Value"
	},
	{ // etc },
	{ // etc },
]
```

### `options.addClass`
Add a css class name to the mapbox HTML element that is rendered.

### `options.template`
Assumes a 1dr templating template (our twig.js wrapper) but basically calls this:
`template.render( markerData )` so in other words, each object in the `options.locations` array will be applied as an argument to the template.render function. So you could use a different template function, as long as it has a `render` method that takes an object as its only argument. Or, set this to false, and use `elementCallback` (below) instead to manually apply your own form of templating. 

### `options.onClick`

Pass a function callback for the marker click eg:

```
{
    onClick: function( e ) {
        // `this` is set to the particular mapbox Marker instance
        // e is the event data
    }
}
```

### `options.elementCallback`
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

# Adding Clusters of markers


Like markers, this handles clustering (using supercluster or L.markerClusters)


```
var myClusters = wrapper.addClusters(options);
```

## Options:


### `options.locations`
Same as addMarkers - this is array of objects with a lat long array, and arbitrary data for each HTML marker (that you may use however you need, but usually for templating the marker HTML) and locations, eg:

```
[
	{
    	"location":["1.30151920","38.98263570"],
	    "title": "My Marker",
    	"customProp": "My Custom Prop Value"
	},
	{ // etc },
	{ // etc },
]
```


### `options.maxZoom`

Sent to `supercluster` this sets the max zoom for clustering to take effect - in other words clusters will not be applied above this zoom level

### `options.minZoom`

Sent to `supercluster` this sets the min zoom for clustering to take effect, in other words clusters will top out at this zoom level. In other words if you set this to '5', then zooming out further will not make the clusters gather more. This is good to avoid all clusters joining to one single cluster, when you have a full world view, for example. 

### `options.step`

It's best to leave this at 1, but if you have a lot of clusters this can improve performance if you increase it. Basically, because mapbox-gl cannot natively do HTML clustering, the way we do this is by adding and removing custom cluster markers (defined by Supercluster). When changing zoom level, the adding and replacing of markers will cause some browser computations, and thus could slow down if this happens at every zoom level (i.e. 1, 2, 3, 4 and so on). By adding a step of over 1, you can only cause a changing of clusters at intervals, for example, a step of 2 would mean the clusters change at zoom level 1, 3, 5, 7 and so on. 

Generally it's better to leave this at 1 and then only increase to try and improve performance if you see it dip. This is an experimental feature, as it requires some hacking with supercluster (which never expected anything other than steps of 1).  


### `options.pinTpl`

Pass a 1dr templating object for the pin (or the marker itself). This calls ` options.pinTpl.render( markerData )` similar to the `addMarker`method. 

### `options.clusterTpl`

As above, a template is passed only this is only passed an object like so: `options.clusterTpl.render({ point_count: 5 })` where it would list the number of 'pins' contained within the cluster. So, 5 in this example. 

### `options.pinCallback`

*click* event callback for the pin, when it's actually displayed (i.e. not hidden by a cluster). EG:

```
{
	pinCallback: function( e, marker, $el, data ) {
		// data is the object from the locations array:
		// for example, render a popup:		
		renderPopup( data );
		
		// marker is the marker object itself in mapbox
		
		// $el is the marker html element, eg
		$el.addClass('active');
	}
}
```

## Methods:

Calling the cluster function from the wrapper, will return an instance of the cluster function with various methods:

```
var clusters = wrapper.addClusters(options);
```


### `clusters.addLocations( locations, repaint )`

Pass in an object just like when you initialise (i.e. the same format as `options.locations`) and this new list will be added. If `repaint` is true, which it is by default, then it will replot everything. Generally you should leave this as `true` because otherwise you're going to get some unexpected behaviour


### `clusters.removeMarker( marker, repaint )`

Remove a marker. `marker` should be a marker object that was created by initialisation or addLocations, as this function will expect certain methods
and properties to be available.

### `clusters.removeMarkers( repaint )`

Remove ALL markers, at once. `repaint` is not true by default, because usually you would most likely want to subsequently call `clusters.addLocations` afterwards, and there's no point trying to repaint when the second function is going to repaint again. Adding and removing clusters is kind of expensive, but there's not really any way around this. Supercluster does not have any methods for adding or removing to its index so new markers always means a rebuild.

### `clusters.replaceMarkers( locations, repaint )`

This is more likely to be used than the last three functions, as usually you are changing a view or a list of markers. It removes markers, and then adds a new set. It is the same as doing this:

```
clusters.removeMarkers();
clusters.addLocations( locations, repaint );
```

It's worth noting that it also removes the `.mapLocation--ready` class, which is then added after a repaint, you can use this to do some styling of transitions, though since it's all a bit unpredictable with timings and map plotting, so far I've not had great results with this, it's probably better to not transition between marker swaps, and just flip as this creates an illusion of fast loading.




# Bookmarks

Using bookmarks is a way to control the map viewport based on specified 'bookmarks'. A bookmark is basically a zoom level, and / or center point. Or, it could just be a _change_ of zoom level. You can also pass jquery selectors, to automaticall bind clicks. For example...


### Set your bookmarks:

_As you can see, for location and zoom levels, you can add mobile alternatives, as often you may need to zoom out further to fit everything else in on mobile._

`target` can be false on each array if you do not want to auto bind clicks, and just use the goto method described below

```
var mapboxBookmarks: [
		{ id: 'center', location: [-38.35,0.45], locationMobile: [-38.35,0.45], zoom: 4, zoomMobile: 2, target: '[data-mapto="center"]' },
		{ id: 'zoom-out', zoomBy: 1, target: '[data-zoomIn]' },
		{ id: 'zoom-in', zoomBy: -1, target: '[data-zoomOut]' },
	]
```

### Create HTML elements to bind clicks to:

(if you're using `target`)

```
<button type="button" class="mapControlButton" data-zoomIn>
	Zoom In
</button>

<button type="button" class="mapControlButton" data-zoomOut>
	Zoom Out
</button>

<button type="button" class="mapControlButton" data-mapto="center">
	Reset Map	
</button>
```

### Add bookmarks to the map:

```
var bookmarks = wraper.addBookmarks( {
	// pass in your bookmarks array, example above:
	bookmarks: mapboxBookmarks,
	
	// default below is 4ms, which is the animation speed for panning:
	animSpeed: 4000,
	
	// pass in a function to check whether to use mobile options or not. You can use your own
	// method of checking, otherwise the function below will be used as a default if you leave this:
	mobileCheck: function() {
		return window.matchMedia( '(max-width: 600px)' ).matches;
	}
});
```

Go to a bookmark by calling it manually:

```
bookmarks.goto( 'center' ); // will go to the 'center' bookmark as set above
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

In theory should just work with `require('mapboxwrapper')` but I haven't tested this ¯\_(ツ)_/¯
