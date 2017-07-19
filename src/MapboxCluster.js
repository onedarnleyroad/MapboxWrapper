
var h = require('./helpers');
var supercluster = require('supercluster');

module.exports = (function() {

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
		template: false,
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
					_process( locations[ prop ] );
				}
			}
		}

		return geoJSON;
	};


	// Main constructor
	var MapboxCluster = function( _options ) {


		var self = this;

		// Create defaults, setup object variables
		var options = $.extend({}, defaults, _options);

		if (!options.map) {
			console.error("MapboxWrapper instance must be provided");
			return;
		}

		// Apply options to object:
		this.radius = options.radius;
		this.maxZoom = options.maxZoom;
		this.minZoom = options.minZoom;
		this.step = options.step;
        this.onClick = h._getProp( 'onClick', options );
		this.clusterCallback = options.clusterCallback;
		this.template = options.template;
        this.count = 0;



		this.clusterTpl = options.clusterTpl;
		this.map = options.map;

		// Setup other properties:
		self.layers = {};
		self.activeLayers = [];
		self.allLayers = false;
		self.zoom = false;
		self.bounds = this.map.LngLatBounds();

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

        // store a count of markers.
        this.count = self.geoJSON.length;

        self.geoJSON.forEach( function( point ) {
            self.bounds.extend( point.geometry.coordinates );
        });

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

			var marker = self.map.addMarker( point.geometry.coordinates, point.properties, self.template  );

			self.leafletClusters.addLayer( marker );

            if (typeof self.onClick === 'function') {
                marker.onClick( self.onClick );
            }

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
			} else {
				template = self.template;
				callback = self.onClick;
			}

			var thisMarker = self.map.addMarker( feature.geometry.coordinates, feature.properties, template );

			// Save Z values to understand which layer they sit on:
			thisMarker.__z = z;
			feature.properties.__z = z;


			var $el = $( thisMarker.getElement() );
			$el.addClass('mapLocation');
			$el.addClass('zoom-' + z).addClass('zoom-' + z).addClass('zoom-layer');


			if (typeof callback === 'function') {
				thisMarker.onClick( function(e) {
					e.preventDefault();
					e.stopPropagation();
					callback( e, thisMarker, $el, feature.properties );
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

		for ( x=1; x<=this.maxZoom; x=x+this.step ) {
			var clusterData = this.index.getClusters( this._getBounds(), x );
			this._addClusterLayer( clusterData, x );
		}

	};

	// Mapbox outputs bounds in a different format than we want
	// to send to supercluster, so this will deal with it:
	MapboxCluster.prototype._getBounds = function() {
		var b = this.bounds;
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
			if (newLayer) {
                newLayer.group.forEach(function( marker ) {
				    marker._addTo( self.map );
			     });
            } else {
                console.log( newLayer, z );
                console.warn("No newLayer");
            }

		})


	};

	return MapboxCluster;

})();
