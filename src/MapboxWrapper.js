var MapboxBookmarks = require('./MapboxBookmarks');
var MapboxMarkers = require('./MapboxMarkers');
var MapboxCluster = require('./MapboxCluster');

var h = require('./helpers');

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

        _popupOptions: function( p, options ) {
            var _m = h._getProp( 'addToMarker', options );
            var _t = h._getProp( 'template', options );
            var _d = h._getProp( 'data', options );

            if (_t && _d) {
                p.setHTML( _t.render( _d ) );
            }

            if (_m) {
                _m.bindPopup( p );
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

            var self = this;

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

			var m = L.marker( [coords[1], coords[0] ], {
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

            // clone / rename to have the same
            // function as mapbox-gl
            m.setPopup = m.bindPopup;

			m.onClick = function(callback) {
				m.on('click', function(e) {
                    // Get element on a click, because with leaflet, it might
                    // not exist earlier.
                    var $el = m.getElement();
                    callback.apply( m, [e, m, $el, data] );
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

        addPopup: function( location, options ) {
            var p = new L.Popup().setLatLng( location );
            p.setHTML = p.setContent;

            _Shared._popupOptions( p, options );

            return p;
        },

		// @TODO - a bit broken on bookmarks, seems to toggle
		// two positions with same args?
		flyTo: function( options, map ) {

			var z = h._getProp( 'zoom', options );
			var center = h._getProp( 'center', options );

			var centerArray;

			if (Array.isArray( center )) {
				centerArray = [center[1], center[0]];
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
			return map.setZoom( z );
		},

		getBounds: function( map ) {

			var b = map.getBounds();

			// Methods are otherwise the same,
			// but the properties are a little different;
			b._sw = b._southWest;
			b._ne = b._northEast;

			return b;
		},

        disableScrollZoom: function( map ) {
            map.scrollWheelZoom.disable();
        },

        enableScrollZoom: function( map ) {
            map.scrollWheelZoom.enable();
        },

        disableDragging: function(map) {
            map.dragging.disable();
        },

        enableDragging: function(map) {
            map.dragging.enable();
        },

        fitBounds: function(bounds, options, map) {

            // Leaflet expects an x / y padding array, but gl is happy with just one number,
            // so convert it here:
            if (typeof options === 'object') {
                if (options.hasOwnProperty('padding') && typeof options.padding === 'number') {
                    options.padding = [ options.padding, options.padding ];
                }
            }

            map.fitBounds( bounds, options );
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
                    e.preventDefault();
                    e.stopPropagation();
					callback.apply( m, [e, m, $el, data] );
				});
			};

            // setting the popup binds the click later,
            // which is a bit annoying.
            m.bindPopup = function(popup) {
                m.setPopup( popup );
                popup.remove();
            };

			if ( data && template ) {
				$el.append( template.render( data ) );
			}

			return m;
		},

        addPopup: function( location, options, map ) {
            var p = new mapboxgl.Popup().addTo( map );
            _Shared._popupOptions( p, options );

            return p;
        },

		flyTo: function( options, map ) {
			return map.flyTo( options, map );
		},

		zoomTo: function ( z, options, map ) {
			return map.zoomTo( z, options );
		},

		getBounds: function( map ) {
			return map.getBounds();
		},

        disableScrollZoom: function( map ) {
            map.scrollZoom.disable();
        },

        enableScrollZoom: function( map ) {
            map.scrollZoom.enable();
        },

        disableDragging: function(map) {
            map.dragPan.disable();
        },

        enableDragging: function(map) {
            map.dragPan.enable();
        },

        fitBounds: function(bounds, alt, map) {
            map.fitBounds( bounds, alt );
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
		self.type = h._getProp( 'type', options );
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

        // Store all popups, just because
        // we don't have a closeAllPopups method native to mapbox, so we
        // can use this.
        this.popups = [];

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

    MapboxWrapper.prototype.once = function( event, cb ) {
        return this.map.once( event, cb );
    };

    MapboxWrapper.prototype.off = function( event, cb ) {
        return this.map.off( event, cb );
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


    MapboxWrapper.prototype.LngLatBounds = function(sw, ne) {
        if (this.type === 'leaflet') {
             return new L.latLngBounds( sw, ne );
        } else if (this.type === 'mapbox-gl') {
            return new mapboxgl.LngLatBounds( sw, ne );
        }
    };

    // Alias of above, because it's super confusing between leaflet
    // and gl switching. Maybe this encourages bad practice....
    MapboxWrapper.prototype.latLngBounds = function( sw, ne ) {
       return this.LngLatBounds( sw, ne );
    };


    MapboxWrapper.prototype.addPopup = function( location, options ) {
        var p = this._methods.addPopup( location, options, this.map );
        this.popups.push(p);
        return p;
    };

    MapboxWrapper.prototype.closeAllPopups = function() {
        this.popups.forEach(function(p) {
            p.remove();
        });
    };

    MapboxWrapper.prototype.fitBounds = function( bounds, alt ) {
        this._methods.fitBounds( bounds, alt, this.map );
    };


	/*======================================
	=            Simple Wrapper Methods    =
	======================================*/

	// Methods where the only argument is the map
	[
		'getMinZoom',
		'getMaxZoom',
		'getZoom',
		'getCenter',
		'getBounds',
        'disableScrollZoom',
        'enableScrollZoom',
        'disableDragging',
        'enableDragging'
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
