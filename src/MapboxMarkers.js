var h = require('./helpers');

module.exports = (function() {

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
		this.locations = h._getProp( 'locations', options ) ;
		this.template =  h._getProp( 'template', options ) ;
		this.elementCallback =  h._getProp( 'elementCallback', options ) ;
		this.onClick =  h._getProp( 'onClick', options ) ;
		this.addClass =  h._getProp( 'addClass', options ) ;

		this.markers = [];
        this.count = 0;

        this.bounds = this.map.LngLatBounds();

		if (this.locations) {
			this.addMarkers();
		}

	};


	MapboxMarkers.prototype.plot = function( markerData ) {

		var self = this;

        // Create the marker, add to map:
		var thisMarker = self.map.addMarker( markerData.location, markerData, self.template );
		thisMarker._addTo( self.map );

        // Extend the stored bounds
        self.bounds.extend( thisMarker.getLngLat() );

        // Get the dom element..
		var $el = $( thisMarker.getElement() );

        // Add a class?
		if ( self.addClass ) {
			$el.addClass( self.addClass );
		}

        // Run a callback on the marker?
		if (typeof self.elementCallback === 'function') {
			self.elementCallback( thisMarker, $el, markerData );
		}

        // run a click handler on the marker?
		if (typeof self.onClick === 'function') {
			thisMarker.onClick( self.onClick );
		}

        // return the marker to whatever called this:
		return thisMarker;

	};

	MapboxMarkers.prototype.addMarkers = function() {
        // run through this.locations, plotting each one, and adding it to the big array.
		var self = this;
		for (var id in self.locations) {
			self.markers.push( self.plot( self.locations[id] ) );
            self.count = self.markers.length;
		}
	};


	return MapboxMarkers;

})();
