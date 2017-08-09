
var h = require('./helpers');
var supercluster = require('supercluster');

module.exports = (function() {


    var _uid = (function() {

        var uid = 0;

        return function() {
            uid++;
            return uid;
        };

    })();

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

                if (loc) {
                    clusterObj.map.flyTo({
                        center: loc,
                        zoom: newZoom + 1
                    });
                }
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



	// Main constructor
	var MapboxCluster = function( _options ) {


		var self = this;

		// Create defaults, setup object variables
		var options = $.extend({}, defaults, _options);

        this._options = options;

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

        this.markers = {};
        this._clusterMarkers = [];
		this.clusterTpl = options.clusterTpl;
		this.map = options.map;

		// Setup other properties:
		self.layers = {};
		self.activeLayers = [];
        this.geoJSON = [];

        self.allLayers = false;
		self.zoom = false;
		self.bounds = this.map.LngLatBounds();

		// Prepare location data, and load the cluster
		if (options.locations) {
			self.locations = options.locations
            self.addLocations( options.locations );
		} else {
            self.locations = [];
        }

        self.map.on('zoom', function() {
            self._check();
        });

        // Paint!
        self._plotLayers();


		return self;
	};

    MapboxCluster.prototype.addLocations = function( locations, repaint ) {

         // Default this to true
        if (typeof repaint === 'undefined') {
            repaint = true;
        }

        if (repaint) {
            $('#' + this.map.container.id + ' .mapLocation').removeClass('mapLocation--ready');
        }

        var self = this;

        requestAnimationFrame( function() {


            var _process = function( data ) {

                var id = _uid();
                var location = data.location;

                // Push to GeoJSON
                var thisObj = {
                    type: 'Feature',
                    properties: { id: id },
                    geometry: { type: "Point", "coordinates": location }
                };

                self.bounds.extend( location );

                self.geoJSON.push( thisObj );

                var thisMarker = self.map.addMarker( location, data, self.template );

                // save id on the marker object:
                thisMarker.__id = id;

                // Add class to the element
                var $el = $( thisMarker.getElement() );
                $el.addClass('mapLocation');

                // save to our global markers object so we can find it later:
                self.markers[ id ] = thisMarker;

                // Set up marker callback
                if (typeof self.onClick === 'function') {
                    thisMarker.onClick( function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        self.onClick( e, thisMarker, $el, data, self );
                    });
                }

                // Remove this marker from the map, it'll be added when it needs to be when the _check happens
                thisMarker._remove();
            };


            // Loop through
            if (Array.isArray( locations ) ) {
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

            if (repaint) {
                self._createLayers();
            }

        });
    };

    MapboxCluster.prototype.removeMarker = function( marker, repaint ) {
        var self = this;
        var __id = marker.__id;

        // Find i from geo
        var geoIndex;
        self.geoJSON.forEach( function(a, i) {
            if (a.properties.id === __id ) {
                geoIndex = i;
            }
        });

        if (typeof geoIndex === 'number') {
            self.geoJSON = self.geoJSON.splice( geoIndex, 1 );
        }

        // Remove from a map
        marker._remove();

        delete self.markers[ __id ];

        // Re calculate the clusters?
        // we can't remove a point from a cluster index, see:
        // https://github.com/mapbox/supercluster/issues/19
        // So until they resolve the above we have to rebuild - it should be avoided
        // to remove clusters.
        //
        // The idea behind repaint is we might want to loop through, remove a lot of markers and
        // only repaint on the last marker, since clusters may change or flash, eg filtered data
        // points.
        if (repaint) {
            self._createLayers();
        }

    };

    MapboxCluster.prototype.removeMarkers = function( repaint ) {
        var self = this;
        self.geoJSON = [];
        for ( var id in self.markers ) {
            if (self.markers.hasOwnProperty( id ) ) {
                var m = self.markers[ id ];
                m._remove();
                delete m;
            }
        };

        // Empty the markers
        self.markers = {};

        // Reset the bounds
        self.bounds = this.map.LngLatBounds();

        // Would effectively kill the clusters, but probably
        // isn't worth calling - you'd be using this in conjunction with replaceMarkers
        if (repaint) {
            self._createLayers();
        }
    };


    MapboxCluster.prototype.replaceMarkers = function( locations, repaint ) {
        // Default this to true
        if (typeof repaint === 'undefined') {
            repaint = true;
        }

        if (repaint) {
            $('#' + this.map.container.id + ' .mapLocation').removeClass('mapLocation--ready');
        }

        var self = this;

        requestAnimationFrame( function() {

            self.removeMarkers();
            self.addLocations( locations, repaint );

        });
    };



    MapboxCluster.prototype._createLayers = function() {
        var self = this;

        if (self.index) {
            // console.log("Before:", self.index );
        } else {
            // console.log("Before, no index set" );
        }

        if (self.map.type === "leaflet") {
            return self._createLeafletLayers();
        }

        // Create new cluster
        self.index = supercluster({
            radius: self._options.radius,
            maxZoom: self._options.maxZoom
        });

        // console.log("After:", self.index );

        // Register the length
        self.count = self.geoJSON.length;

        // create the clusters group:
        self.clusters = self.index.load( self.geoJSON );

        // Plot layers
        self._plotLayers();

        // Perform a zoom check and add / remove markers as necessary.
        // Pass true to create a repaint
        self._check( true );
    };


	MapboxCluster.prototype._createLeafletLayers = function () {

		var self = this;

		if (self.map.type != 'leaflet') {
			console.error("Cannot plot leaflet layers on " + self.map.type + " map"); return;
		}

        if (self.leafletClusters) {
            self.leafletClusters.remove();
        }

		// create L cluster:
		self.leafletClusters = new L.MarkerClusterGroup({
			spiderfyOnMaxZoom: false,
			showCoverageOnHover: false
		});

		for ( var id in self.markers ) {
            if (self.markers.hasOwnProperty( id ) ) {
                var m = self.markers[ id ];
                m._remove();
                self.leafletClusters.addLayer( m );
            }
        };

		self.leafletClusters.addTo( self.map.map );


	};

	MapboxCluster.prototype._check = function( force ) {

        if (this.map.type === 'leaflet') { return; }

        var _z = this.map.getZoom();
		var z = this._getSteppedZoom( _z );

		if ( z != this.zoom || force ) {
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


    // Take the clusters for each zoom level,
    // and add the layer.
    MapboxCluster.prototype._plotLayers = function() {

        // Kill layers:
        this.layers = {};

        var bounds = this._getBounds();
        if (!bounds) {
            // Must be no layers to plot.
            return;
        }

        // Remove cluster markers from map
        this._clusterMarkers.forEach( function( cm ) {
            cm._remove();
            delete cm;
        });

        // Remove any markers from map, but don't
        // delete, just hide them for plotting later.
        for ( var id in this.markers ) {
            if (this.markers.hasOwnProperty( id ) ) {
                var m = this.markers[ id ];
                m._remove();
            }
        };

        // Reset clusters:
        this._clusterMarkers = [];

        var tLabel = 'Plotting Layers';
        console.time( tLabel );
        for ( x=1; x<=this.maxZoom; x=x+this.step ) {

            var clusterData = this.index.getClusters( this._getBounds(), x );
            var result = this._addClusterLayer( clusterData, x );
            // console.log( result );
        }

        console.timeEnd( tLabel );
    };

    // Take a cluster layer and add it to the map.
	MapboxCluster.prototype._addClusterLayer = function( data, z ) {

		var group = [], $els;
		var self = this;


		if (self.map.type === 'leaflet') {
			console.error('_addClusterLayer does not work for leaflet maps. Use _plotLeafletLayers instead');
			return;
		}


        var _markersCount = 0;
        var _clusterCount = 0;


		data.forEach(function( feature ) {

			var thisMarker;

            // If feature is a cluster, then create a marker and plot it:
			if ( feature.properties.hasOwnProperty('cluster') && feature.properties.cluster ) {

                thisMarker = self.map.addMarker( feature.geometry.coordinates, feature.properties, self.clusterTpl );

                if (typeof self.clusterCallback === 'function') {
                    thisMarker.onClick( function(e) {
                        if (e) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                        self.clusterCallback( e, thisMarker, $el, feature.properties, self );
                    });
                }

                _clusterCount++;
                self._clusterMarkers.push( thisMarker );
                var isCluster = true;
			} else {
                thisMarker = self.markers[ feature.properties.id ];
                _markersCount++;
                var isCluster = false;
            }

			// Save Z values to understand which layer they sit on:
			thisMarker.__z = z;
			feature.properties.__z = z;

			var $el = $( thisMarker.getElement() );


            // Will have already been set on the marker, but this sets it on clusters anyway
            $el.addClass( 'mapLocation' ).addClass('mapLocation--ready');

            if (isCluster) {
                $el.addClass('mapLocation--cluster');
            } else {
                $el.addClass('mapLocation--marker');
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

        return {
            clusters: _clusterCount,
            markers: _markersCount,
            z: z
        };

	};




	// Mapbox outputs bounds in a different format than we want
	// to send to supercluster, so this will deal with it:
	MapboxCluster.prototype._getBounds = function() {
		var b = this.bounds;
        if (!b.hasOwnProperty('_sw')) { return false; }
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
                // console.log( newLayer, z );
                console.warn("No newLayer for " + z);
            }

		})


	};

	return MapboxCluster;

})();
