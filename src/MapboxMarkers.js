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

        this.bounds = this.map.LngLatBounds();

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

        self.bounds.extend( markerData.location );

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
