(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.MapboxWrapper = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;MapboxBookmarks = (function() {


	var MapboxBookmarks = function( options ) {
		this.map = options.map;
		this.bookmarks = {};

		var self = this;



		options.bookmarks.forEach(function( bookmark ) {

			var b = {};

			// use _getProp to set the property of b based on the properties
			// given, OR set it to false if it doesn't exist. This just shortens
			// the code here, and allows us to add properties quickly to this array
			// as we think of them.
			[
				'location',
				'locationMobile',
				'zoom',
				'zoomMobile',
				'zoomBy'
			].forEach(function( prop ) {
				b[prop] = _getProp( prop, bookmark );
			});


			if (typeof b.zoomBy === "number") {
				b.goto = function() {
					var z = self.map.getZoom();
					var minZ = self.map.getMinZoom();
					var maxZ = self.map.getMaxZoom();
					var newZ = _limitNumber( Math.round( z + b.zoomBy), minZ, maxZ );
					self.map.zoomTo( newZ );
				};
			} else if ( b.location || b.zoom ) {
				b.goto = function() {

					var loc = b.location;
					var z = b.zoom

					if ( b.locationMobile && APP.media.matches('mobile') ) {
						loc = b.locationMobile;
					}

					if ( b.zoomMobile && APP.media.matches('mobile') ) {
						z = b.zoomMobile;
					}

					self.map.flyTo({
						speed: APP.config.animSpeed,
						zoom: z,
						center: loc
					});
				};
			} else {
				// silently do nothing
				b.goto = function() {};
			}

			var target = _getProp( 'target', bookmark );


			if (typeof target === "string") {
				APP.promises.ready(function() {
					$('body').on('click', target, function( e ) {
						e.preventDefault();
						this.blur();
						b.goto( bookmark.id );
					});
				});
			}

			self.bookmarks[ bookmark.id ] = b;

		});

		return this;
	};


	MapboxBookmarks._getBookmark = function( id ) {
		return this.bookmarks[ id ];
	};


	MapboxBookmarks.goto = function( id ) {
		this._getBookmark( id ).goto();
	};

	return MapboxBookmarks;

})();

},{}],2:[function(require,module,exports){

MapboxCluster = (function(w) {

	// EXPECTS A MapboxWrapper object
	// and NOT a mapbox-gl object.

	// 'options.map' should be an instance of MapboxWrapper

	var defaults = {
		radius: 50,
		maxZoom: 22,
		minZoom: 1,

		// group layers by this amount, reduce for performance, or amount of clusters
		step: 2,

		// Callbacks for pin and cluster,
		// use these for binding click events and the like
		pinCallback: function( marker, $el, markerData, clusterObj ) {},
		clusterCallback: function( e, marker, $el, markerData, clusterObj ) {


				e.preventDefault();
				e.stopPropagation();

				var newZoom = clusterObj.getExpansionZoom( markerData );

				if ( clusterObj.map.type === 'leaflet' ) {

				}

				var loc = marker.getLngLat();

				clusterObj.map.flyTo({
					center: loc,
					zoom: newZoom + 1
				});

		},

		// Swig templates for each cluster
		pinTpl: false,
		clusterTpl: false,

		// Either pass in geoJSON prepared, which will save
		// a bit of client spin-up time if you can do this
		// with twig.
		geoJSON: false,

		// OR pass in locations in this format:
		// {
		// 		location: [lat, lng],
		//		customProp: '',
		//		customProp: '',
		// }
		locations: false
	};

	// helper function
	var _locationsToGeoJson = function( locations, type ) {

		var geoJSON = [];

		var _process = function( data ) {

			var thisObj = {
				type: 'Feature',
				properties: data,
				geometry: { type: "Point", "coordinates": data.location }
			};

			geoJSON.push( thisObj );
		};

		if (Array.isArray( location ) ) {
			locations.forEach( _process );
		} else {
			for (var prop in locations ) {
				if ( !locations.hasOwnProperty( prop ) ) {
					return;
				} else {
					_process( APP.mapData.locations[ prop ] );
				}
			}
		}

		return geoJSON;
	};


	// Main constructor
	var MapboxCluster = function( options ) {


		var self = this;

		// Create defaults, setup object variables
		var options = $.extend({}, defaults, options);

		if (!options.map) {
			console.error("MapboxWrapper instance must be provided");
			return;
		}

		// Apply options to object:
		this.radius = options.radius;
		this.maxZoom = options.maxZoom;
		this.minZoom = options.minZoom;
		this.step = options.step;
		this.pinCallback = options.pinCallback;
		this.clusterCallback = options.clusterCallback;
		this.pinTpl = options.pinTpl;
		this.clusterTpl = options.clusterTpl;
		this.map = options.map;

		// Setup other properties:
		self.layers = {};
		self.activeLayers = [];
		self.allLayers = false;
		self.zoom = false;
		self.bounds = self._getBounds();


		// Prepare location data, and load the cluster
		if (options.locations) {
			self.locations = options.locations
			self.geoJSON = _locationsToGeoJson( options.locations );
		} else {
			self.geoJSON = options.geoJSON;
			if (!self.geoJSON) {
				console.error("No geoJSON or locations provided");
			}
		}

		// SPINUP:
		//

		if ( this.map.type === 'leaflet' ) {
			self._plotLeafletLayers();
		} else {

			// create supercluster
			self.index = supercluster({
				radius: options.radius,
				maxZoom: options.maxZoom
			});

			// load in data points to supercluster
			self.clusters = self.index.load( self.geoJSON );

			// plot these
			self._plotLayers();

			// Listen to zoom event to change layers,
			// remember that the callback's 'this' is mapbox
			// nto this constructor.
			self.map.on('zoom', function() {
				self._check()
			});
			self._check();
		}



		return self;
	};


	MapboxCluster.prototype._plotLeafletLayers = function () {

		var self = this;

		if (self.map.type != 'leaflet') {
			console.error("Cannot plot leaflet layers on " + self.map.type + " map"); return;
		}

		// create L cluster:
		self.leafletClusters = new L.MarkerClusterGroup({
			spiderfyOnMaxZoom: false,
			showCoverageOnHover: false
		});

		self.geoJSON.forEach( function( point ) {

			var marker = self.map.addMarker( point.geometry.coordinates, point.properties, self.pinTpl  );

			self.leafletClusters.addLayer( marker );


			marker.on('click', function(e) {

				if (typeof self.pinCallback === 'function') {
					var $el = $( marker.getElement() );
					self.pinCallback( e, marker, $el, point.properties, self );
				}
			});

		});

		self.leafletClusters.addTo( self.map.map );


	};

	MapboxCluster.prototype._check = function() {

		var _z = this.map.getZoom();
		var z = this._getSteppedZoom( _z );

		if ( z != this.zoom ) {
			this.zoom = z;
			this.switchLayer( z );
		}
	};

	MapboxCluster.prototype._getSteppedZoom = function( _z ) {
		// Flatten out numbers to only
		// be multiples of the step, starting
		// from 1, hence ceiling:



		if (!_z) {
			var _z = this.map.getZoom();
		}

		// Can't deal with steps?
		if (this.type === "leaflet" ) {
			return _z;
		}

		// Process the zoom and ensure that we have steps starting from 1:
		// eg step 3 would be 1, 4, 7
		// or step 2 would be 1, 3, 5
		//

		var step = this.step;

		// this enables us share cluster layers across a few zoom levels,
		// but supercluster still has the data for more increments should we want to adjust.

		// Long Version:
		var _a = _z / step;
		var _b = Math.ceil( _a );
		var _zeroIndex = _b - 1;
		var _multiple = _zeroIndex * step;
		var z = _multiple + 1;

		// Condensed:
		// var z = ( ( Math.ceil( this.map.getZoom() / this.step ) - 1 ) * this.step ) + 1
		return z;
	};


	MapboxCluster.prototype.getExpansionZoom = function( data ) {

		// This is a wrapper for:
		// [supercluster] index.getClusterExpansionZoom()
		// because we use the 'step' method, we need to pick a zoom rounded to the number
		// we want, to avoid 'missing' zoom levels.

		// get expected zoom:
		var _z = this.index.getClusterExpansionZoom( data.cluster_id, data.__z );

		// Adjust it to the actual zoom layer based on steps:
		// var z = this._getSteppedZoom( _z );

		// if ( _z > z ) {
		// 	// ensure we go up a step
		// 	z = z + this.step;
		// }

		// encourage next zoom down always, if the rounded zoom is less, than we won't
		// zoom in, so just step by current zoom plus step.
		return _z;
	};


	MapboxCluster.prototype._addClusterLayer = function( data, z ) {

		var group = [], $els;
		var self = this;

		if (self.map.type === 'leaflet') {
			console.error('_addClusterLayer does not work for leaflet maps. Use _plotLeafletLayers instead');
			return;
		}

		// This will always reset a zoom layer
		data.forEach(function( feature ) {

			var template, callback;

			if ( feature.properties.hasOwnProperty('cluster') && feature.properties.cluster ) {
				template = self.clusterTpl;
				callback = self.clusterCallback;
			} else if (feature.properties.hasOwnProperty('type') && feature.properties.type === "mapLocation" ) {
				template = self.pinTpl;
				callback = self.pinCallback;
			}

			var thisMarker = self.map.addMarker( feature.geometry.coordinates, feature.properties, template );

			// Save Z values to understand which layer they sit on:
			thisMarker.__z = z;
			feature.properties.__z = z;


			var $el = $( thisMarker.getElement() );
			$el.addClass('mapLocation');
			$el.addClass('zoom-' + z).addClass('zoom-' + z).addClass('zoom-layer');


			if (typeof callback === 'function') {
				$el.on('click', function(e) {
					e.preventDefault();
					e.stopPropagation();
					callback( e, thisMarker, $el, feature.properties, self );
				});
			}

			// Create a jquery group for all of these items:
			if ($els) {
				$els = $els.add( $el );
			} else {
				$els = $el;
			}

			group.push( thisMarker );

		});

		self.layers[ z ] = {
			group: group,
			$collection: $els
		};

	};


	MapboxCluster.prototype._plotLayers = function() {



		for ( x=this.maxZoom; x>=this.minZoom; x=x-this.step ) {
			var clusterData = this.index.getClusters( this.bounds, x );
			this._addClusterLayer( clusterData, x );
		}

	};

	// Mapbox outputs bounds in a different format than we want
	// to send to supercluster, so this will deal with it:
	MapboxCluster.prototype._getBounds = function() {
		var b = this.map.getBounds();
		return [ b._sw.lng, b._sw.lat, b._ne.lng, b._ne.lat ];
	};

	MapboxCluster.prototype.switchLayer = function( z ) {

		var self = this;

		requestAnimationFrame(function() {

			// Clear the active
			if (self.activeLayer) {
				var oldZ = self.activeLayer;
			}

			// Set the new one:
			self.activeLayer = z;

			var newLayer = self.layers[ z ];
			var oldLayer = self.layers[ oldZ ];

			// transitions generally tend to make things sluggish
			if (oldLayer) {
				oldLayer.group.forEach(function( marker ) {
					marker._remove();
				});
			}

			// Add it to the map
			newLayer.group.forEach(function( marker ) {
				marker._addTo( self.map );
			});

		})


	};

	return MapboxCluster;

})( window );

},{}],3:[function(require,module,exports){
MapboxMarkers = (function() {

	/*
		Wrappers to take an array of markers, and plot them on mapbox gl or JS as needed,
		using a twig.js template to render them, and callbacks to bind clicks or whatever.

		Use instead of MapboxCluster
	*/



	var MapboxMarkers = function( options ) {


		var self = this;

		if (!options.map) {
			console.error("Mapbox object must be provided");
			return;
		}

		this.map = options.map;
		this.locations = _getProp( 'locations', options ) ;
		this.template =  _getProp( 'template', options ) ;
		this.elementCallback =  _getProp( 'elementCallback', options ) ;
		this.onClick =  _getProp( 'onClick', options ) ;
		this.addClass =  _getProp( 'addClass', options ) ;

		this.markers = [];

		if (this.locations) {
			this.addMarkers();
		}

	};


	MapboxMarkers.prototype.plot = function( markerData ) {

		var self = this;

		var thisMarker;

		var addClass = self.addClass;
		var template = self.template;
		var elementCallback = self.elementCallback;
		var onClick = self.onClick;

		var thisMarker = self.map.addMarker( markerData.location, markerData, template );
		thisMarker._addTo( self.map );

		var $el = $( thisMarker.getElement() );

		if ( addClass ) {
			$el.addClass( addClass );
		}

		if (typeof elementCallback === 'function') {
			elementCallback( thisMarker, $el, markerData );
		}

		if (typeof onClick === 'function') {
			thisMarker.onClick( onClick );
		}

		return thisMarker;

	};

	MapboxMarkers.prototype.addMarkers = function() {

		var self = this;
		for (var id in self.locations) {
			self.markers.push( self.plot( self.locations[id] ) );
		}
	};


	return MapboxMarkers;

})();

},{}],4:[function(require,module,exports){
var MapboxBookmarks = require('./MapboxBookmarks');
var MapboxMarkers = require('./MapboxMarkers');
var MapboxCluster = require('./MapboxCluster');

module.exports = (function() {




	// @TODO - add these and implement them,
	// for now, 'options' below expects everything,
	// and checks for nothing.
	var mapboxDefaults = {

	};

	/*=========================================
	=            Wrapper Functions            =

		Specific to each type of Mapbox,
		these are objects with identical
		methods to make swapping easier.
	=========================================*/


	// Luckily, some are just the same:
	var _Shared = {

		_addTo: function( marker, map ) {
			if (map.hasOwnProperty( 'map' )) {
				marker.addTo( map.map );
			} else {
				marker.addTo( map );
			}
		},

		getZoom: function( map ) {
			return map.getZoom();
		},

		getMinZoom: function( map ) {
			return map.getMinZoom();
		},

		getMaxZoom: function( map ) {
			return map.getMaxZoom();
		},

		getCenter: function( map ) {
			return map.getCenter();
		},

		updateConfig: function( prop, value, map ) {
			switch (prop) {
				case 'maxZoom':
					map.setMaxZoom( value );
				break;

				case 'minZoom':
					map.setMinZoom( value );
				break;
			}
		}
	};


	var _Leaflet = $.extend( {}, _Shared, {

		map: function( options ) {
			L.mapbox.accessToken = options.accessToken;

			// somewhere along the line, gl swapped
			// coords from [lat,lng], to [lng,lat]:
			map = L.mapbox.map( options.container );

	    	// onload will *never* fire if it is attached *after* setView:
	    	if (typeof options.onLoad === "function") {
	    		map.on('load', options.onLoad );
	    	}

	    	map.setView( [options.center[1],options.center[0]], options.zoom );

			// Use styleLayer to add a Mapbox style created in Mapbox Studio
			L.mapbox.styleLayer( options.style ).addTo( map );

			return map;
		},

		// This differes from Mapbox in that we can pass in the data now,
		// because the element doesn't exist, until it does, and then sometimes
		// it doesn't. It's pretty annoying.
		addMarker: function( coords, data, template ) {

			var html;

			if ( data && template ) {
				html = template.render( data );
			} else {
				html = false
			}

			// @TODO - stop hard coding the icon size
			var icon = L.divIcon({
				className: 'mapLocation',
				// Set icon to be 1,1, which is a pixel point on the map,
				// then use overflowing elements positioned around it how you like
				// with css
				iconSize: [1,1],
				html: html
			});

			var m = L.marker( coords.reverse(), {
				icon: icon
			});

			m.__enabled = false;
			m.__el = false;

			m._addTo = function( map ) {

				if (!m.__enabled) {
					m.__enabled = true;
					m.__el = m.getElement();
					_Shared._addTo( m, map );

				} else {
					m.setOpacity(1);
					$( m.__el ).css('visibility', 'visible');
				}

			};

			m.onClick = function(callback) {
				m.on('click', function(e) {
					callback.apply( m, [e] );
				});
			};

			m._remove = function() {
				m.setOpacity(0);
				$( m.__el ).css('visibility', 'hidden');
			};


			m.getLngLat = function() {
				return m.getLatLng();
			};

			return m;
		},

		// @TODO - a bit broken on bookmarks, seems to toggle
		// two positions with same args?
		flyTo: function( options, map ) {

			var z = _getProp( 'zoom', options );
			var center = _getProp( 'center', options );

			var centerArray;

			if (Array.isArray( center )) {
				centerArray = center.reverse();
			} else {
				centerArray = [center.lat,center.lng];
			}

			if (z && centerArray) {
				map.flyTo(centerArray, z);
			} else {
				if (z) {
					map.setZoom();
				}

				if (centerArray) {
					map.panTo( centerArray );
				}
			}
		},

		zoomTo: function ( z, options, map ) {

			console.log( z );

			return map.setZoom( z );
		},

		getBounds: function( map ) {

			var b = map.getBounds();

			// Methods are otherwise the same,
			// but the properties are a little different;
			b._sw = b._southWest;
			b._ne = b._northEast;

			return b;
		}

	});

	var _Mapbox = $.extend( {}, _Shared, {

		map: function( options ) {
			mapboxgl.accessToken = options.accessToken;
			var map = new mapboxgl.Map( options );
			if (typeof options.onLoad === "function") {
	    		map.on('load', options.onLoad );
	    	}
			return map;
		},

		addMarker: function(coords, data, template ) {

			var m = new mapboxgl.Marker()
				.setLngLat( coords );

			m._addTo = function( map ) {
				_Shared._addTo( m, map );
			};

			m._remove = function() {
				m.remove();
			};

			var $el = $( m.getElement() );

			m.onClick = function(callback) {
				$el.on('click', function(e) {
					callback.apply( m, [e] );
				});
			};

			if ( data && template ) {
				$el.append( template.render( data ) );
			}

			return m;
		},

		flyTo: function( options, map ) {
			return map.flyTo( options, map );
		},

		zoomTo: function ( z, options, map ) {
			return map.zoomTo( z, options );
		},

		getBounds: function( map ) {
			return map.getBounds();
		}

	});

	/*=====  End of Wrapper Functions  ======*/


	/*=============================
	=            Setup            =

		Pass in options, this
		functions decides which
		version to initalise

	=============================*/
	var MapboxWrapper = function( options ) {

		var self = this;

		// For testing, allow a force of type:
		self.type = _getProp( 'type', options );
		self.options = options

		if (!self.type || (self.type != 'mapbox-gl' && self.type != 'leaflet' )) {
			// Do a check for JS or mapbox
			if ( mapboxgl ) {
				self.type = ( mapboxgl.supported() ) ? 'mapbox-gl' : 'leaflet';
			} else {
				// Use our copt
				self.type = ( MapboxIsSupported() ) ? 'mapbox-gl' : 'leaflet';
			}
		}

		if (self.type === 'mapbox-gl') {
			self._methods = _Mapbox;
		} else if (self.type === 'leaflet') {
			self._methods = _Leaflet;
		}

		this.map = this._methods.map( this.options );

		this.container = this.map.getContainer();

		this.map.on('load', function() {

			$( self.container ).addClass('ready');

		});

		return this;

	};
	/*=====  End of Setup  ======*/



	/*=========================================
	=            Prototype Methods            =

		Call functions below without caring
		which map has been initalised.

		For ease and compatability, where relevant
		these should share names and implementation
		with mapbox-gl.js, rather than mapbox.js / Leaflet.js

		Of course, we'll use some streamlining
		where possible (eg leveraging vars stored
		in 'this'), so we aren't trying
		to mirror Mapbox-gl exactly.

	=========================================*/

	MapboxWrapper.prototype.on = function( event, cb ) {
		return this.map.on( event, cb );
	};

	MapboxWrapper.prototype.updateConfig = function( prop, value ) {
		this._methods.updateConfig( prop, value, this.map );
	};

	MapboxWrapper.prototype.addMarker = function( coords, data, template ) {
		return this._methods.addMarker( coords, data, template );
	};

	MapboxWrapper.prototype.flyTo = function( options ) {
		return this._methods.flyTo( options, this.map );
	};

	MapboxWrapper.prototype.zoomTo = function( z, options ) {
		this._methods.zoomTo( z, options, this.map );
	};


	/*======================================
	=            Getter Methods            =
	======================================*/

	// Speeds up development, condenses code:
	[
		'getMinZoom',
		'getMaxZoom',
		'getZoom',
		'getCenter',
		'getBounds'
	].forEach( function( method ) {
		// separation of self and 'this' here,
		// because Mapbox may use this in ways
		// we don't know, or the user could apply
		// within the function invocation?
		MapboxWrapper.prototype[method] = function() {
			return this._methods[method]( this.map );
		};

	});

	MapboxWrapper.prototype._extendOptions = function(options) {
		return $.extend({}, options, {
			map: this
		});
	};

	/* Bind in libraries */
	MapboxWrapper.prototype.addMarkers = function (options) {
		return new MapboxMarkers( this._extendOptions(options) );
	};

	MapboxWrapper.prototype.addCluster = function (options) {
		return new MapboxCluster( this._extendOptions(options) );
	};

	MapboxWrapper.prototype.addBookmarks = function (options) {
		return new MapboxBookmarks( this._extendOptions(options) );
	};



	return MapboxWrapper;
})();

},{"./MapboxBookmarks":1,"./MapboxCluster":2,"./MapboxMarkers":3}],5:[function(require,module,exports){
module.exports = require('./MapboxWrapper.js');

},{"./MapboxWrapper.js":4}]},{},[5])(5)
});