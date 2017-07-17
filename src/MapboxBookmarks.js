var h = require('./helpers');

module.exports = (function() {


	var MapboxBookmarks = function( options ) {
		this.map = options.map;
		this.bookmarks = {};

		var self = this;



		options.bookmarks.forEach(function( bookmark ) {

			var b = {};

			// use h._getProp to set the property of b based on the properties
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
				b[prop] = h._getProp( prop, bookmark );
			});


			if (typeof b.zoomBy === "number") {
				b.goto = function() {
					var z = self.map.getZoom();
					var minZ = self.map.getMinZoom();
					var maxZ = self.map.getMaxZoom();
					var newZ = h._limitNumber( Math.round( z + b.zoomBy), minZ, maxZ );
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

			var target = h._getProp( 'target', bookmark );


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
