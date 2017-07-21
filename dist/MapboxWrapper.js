(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.MapboxWrapper = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var sort = require('./sort');
var range = require('./range');
var within = require('./within');

module.exports = kdbush;

function kdbush(points, getX, getY, nodeSize, ArrayType) {
    return new KDBush(points, getX, getY, nodeSize, ArrayType);
}

function KDBush(points, getX, getY, nodeSize, ArrayType) {
    getX = getX || defaultGetX;
    getY = getY || defaultGetY;
    ArrayType = ArrayType || Array;

    this.nodeSize = nodeSize || 64;
    this.points = points;

    this.ids = new ArrayType(points.length);
    this.coords = new ArrayType(points.length * 2);

    for (var i = 0; i < points.length; i++) {
        this.ids[i] = i;
        this.coords[2 * i] = getX(points[i]);
        this.coords[2 * i + 1] = getY(points[i]);
    }

    sort(this.ids, this.coords, this.nodeSize, 0, this.ids.length - 1, 0);
}

KDBush.prototype = {
    range: function (minX, minY, maxX, maxY) {
        return range(this.ids, this.coords, minX, minY, maxX, maxY, this.nodeSize);
    },

    within: function (x, y, r) {
        return within(this.ids, this.coords, x, y, r, this.nodeSize);
    }
};

function defaultGetX(p) { return p[0]; }
function defaultGetY(p) { return p[1]; }

},{"./range":2,"./sort":3,"./within":4}],2:[function(require,module,exports){
'use strict';

module.exports = range;

function range(ids, coords, minX, minY, maxX, maxY, nodeSize) {
    var stack = [0, ids.length - 1, 0];
    var result = [];
    var x, y;

    while (stack.length) {
        var axis = stack.pop();
        var right = stack.pop();
        var left = stack.pop();

        if (right - left <= nodeSize) {
            for (var i = left; i <= right; i++) {
                x = coords[2 * i];
                y = coords[2 * i + 1];
                if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[i]);
            }
            continue;
        }

        var m = Math.floor((left + right) / 2);

        x = coords[2 * m];
        y = coords[2 * m + 1];

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(ids[m]);

        var nextAxis = (axis + 1) % 2;

        if (axis === 0 ? minX <= x : minY <= y) {
            stack.push(left);
            stack.push(m - 1);
            stack.push(nextAxis);
        }
        if (axis === 0 ? maxX >= x : maxY >= y) {
            stack.push(m + 1);
            stack.push(right);
            stack.push(nextAxis);
        }
    }

    return result;
}

},{}],3:[function(require,module,exports){
'use strict';

module.exports = sortKD;

function sortKD(ids, coords, nodeSize, left, right, depth) {
    if (right - left <= nodeSize) return;

    var m = Math.floor((left + right) / 2);

    select(ids, coords, m, left, right, depth % 2);

    sortKD(ids, coords, nodeSize, left, m - 1, depth + 1);
    sortKD(ids, coords, nodeSize, m + 1, right, depth + 1);
}

function select(ids, coords, k, left, right, inc) {

    while (right > left) {
        if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            select(ids, coords, k, newLeft, newRight, inc);
        }

        var t = coords[2 * k + inc];
        var i = left;
        var j = right;

        swapItem(ids, coords, left, k);
        if (coords[2 * right + inc] > t) swapItem(ids, coords, left, right);

        while (i < j) {
            swapItem(ids, coords, i, j);
            i++;
            j--;
            while (coords[2 * i + inc] < t) i++;
            while (coords[2 * j + inc] > t) j--;
        }

        if (coords[2 * left + inc] === t) swapItem(ids, coords, left, j);
        else {
            j++;
            swapItem(ids, coords, j, right);
        }

        if (j <= k) left = j + 1;
        if (k <= j) right = j - 1;
    }
}

function swapItem(ids, coords, i, j) {
    swap(ids, i, j);
    swap(coords, 2 * i, 2 * j);
    swap(coords, 2 * i + 1, 2 * j + 1);
}

function swap(arr, i, j) {
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}

},{}],4:[function(require,module,exports){
'use strict';

module.exports = within;

function within(ids, coords, qx, qy, r, nodeSize) {
    var stack = [0, ids.length - 1, 0];
    var result = [];
    var r2 = r * r;

    while (stack.length) {
        var axis = stack.pop();
        var right = stack.pop();
        var left = stack.pop();

        if (right - left <= nodeSize) {
            for (var i = left; i <= right; i++) {
                if (sqDist(coords[2 * i], coords[2 * i + 1], qx, qy) <= r2) result.push(ids[i]);
            }
            continue;
        }

        var m = Math.floor((left + right) / 2);

        var x = coords[2 * m];
        var y = coords[2 * m + 1];

        if (sqDist(x, y, qx, qy) <= r2) result.push(ids[m]);

        var nextAxis = (axis + 1) % 2;

        if (axis === 0 ? qx - r <= x : qy - r <= y) {
            stack.push(left);
            stack.push(m - 1);
            stack.push(nextAxis);
        }
        if (axis === 0 ? qx + r >= x : qy + r >= y) {
            stack.push(m + 1);
            stack.push(right);
            stack.push(nextAxis);
        }
    }

    return result;
}

function sqDist(ax, ay, bx, by) {
    var dx = ax - bx;
    var dy = ay - by;
    return dx * dx + dy * dy;
}

},{}],5:[function(require,module,exports){
'use strict';

var kdbush = require('kdbush');

module.exports = supercluster;

function supercluster(options) {
    return new SuperCluster(options);
}

function SuperCluster(options) {
    this.options = extend(Object.create(this.options), options);
    this.trees = new Array(this.options.maxZoom + 1);
}

SuperCluster.prototype = {
    options: {
        minZoom: 0,   // min zoom to generate clusters on
        maxZoom: 16,  // max zoom level to cluster the points on
        radius: 40,   // cluster radius in pixels
        extent: 512,  // tile extent (radius is calculated relative to it)
        nodeSize: 64, // size of the KD-tree leaf node, affects performance
        log: false,   // whether to log timing info

        // a reduce function for calculating custom cluster properties
        reduce: null, // function (accumulated, props) { accumulated.sum += props.sum; }

        // initial properties of a cluster (before running the reducer)
        initial: function () { return {}; }, // function () { return {sum: 0}; },

        // properties to use for individual points when running the reducer
        map: function (props) { return props; } // function (props) { return {sum: props.my_value}; },
    },

    load: function (points) {
        var log = this.options.log;

        if (log) console.time('total time');

        var timerId = 'prepare ' + points.length + ' points';
        if (log) console.time(timerId);

        this.points = points;

        // generate a cluster object for each point
        var clusters = points.map(createPointCluster);
        if (log) console.timeEnd(timerId);

        // cluster points on max zoom, then cluster the results on previous zoom, etc.;
        // results in a cluster hierarchy across zoom levels
        for (var z = this.options.maxZoom; z >= this.options.minZoom; z--) {
            var now = +Date.now();

            // index input points into a KD-tree
            this.trees[z + 1] = kdbush(clusters, getX, getY, this.options.nodeSize, Float32Array);

            clusters = this._cluster(clusters, z); // create a new set of clusters for the zoom

            if (log) console.log('z%d: %d clusters in %dms', z, clusters.length, +Date.now() - now);
        }

        // index top-level clusters
        this.trees[this.options.minZoom] = kdbush(clusters, getX, getY, this.options.nodeSize, Float32Array);

        if (log) console.timeEnd('total time');

        return this;
    },

    getClusters: function (bbox, zoom) {
        var tree = this.trees[this._limitZoom(zoom)];
        var ids = tree.range(lngX(bbox[0]), latY(bbox[3]), lngX(bbox[2]), latY(bbox[1]));
        var clusters = [];
        for (var i = 0; i < ids.length; i++) {
            var c = tree.points[ids[i]];
            clusters.push(c.numPoints ? getClusterJSON(c) : this.points[c.id]);
        }
        return clusters;
    },

    getChildren: function (clusterId, clusterZoom) {
        var origin = this.trees[clusterZoom + 1].points[clusterId];
        var r = this.options.radius / (this.options.extent * Math.pow(2, clusterZoom));
        var points = this.trees[clusterZoom + 1].within(origin.x, origin.y, r);
        var children = [];
        for (var i = 0; i < points.length; i++) {
            var c = this.trees[clusterZoom + 1].points[points[i]];
            if (c.parentId === clusterId) {
                children.push(c.numPoints ? getClusterJSON(c) : this.points[c.id]);
            }
        }
        return children;
    },

    getLeaves: function (clusterId, clusterZoom, limit, offset) {
        limit = limit || 10;
        offset = offset || 0;

        var leaves = [];
        this._appendLeaves(leaves, clusterId, clusterZoom, limit, offset, 0);

        return leaves;
    },

    getTile: function (z, x, y) {
        var tree = this.trees[this._limitZoom(z)];
        var z2 = Math.pow(2, z);
        var extent = this.options.extent;
        var r = this.options.radius;
        var p = r / extent;
        var top = (y - p) / z2;
        var bottom = (y + 1 + p) / z2;

        var tile = {
            features: []
        };

        this._addTileFeatures(
            tree.range((x - p) / z2, top, (x + 1 + p) / z2, bottom),
            tree.points, x, y, z2, tile);

        if (x === 0) {
            this._addTileFeatures(
                tree.range(1 - p / z2, top, 1, bottom),
                tree.points, z2, y, z2, tile);
        }
        if (x === z2 - 1) {
            this._addTileFeatures(
                tree.range(0, top, p / z2, bottom),
                tree.points, -1, y, z2, tile);
        }

        return tile.features.length ? tile : null;
    },

    getClusterExpansionZoom: function (clusterId, clusterZoom) {
        while (clusterZoom < this.options.maxZoom) {
            var children = this.getChildren(clusterId, clusterZoom);
            clusterZoom++;
            if (children.length !== 1) break;
            clusterId = children[0].properties.cluster_id;
        }
        return clusterZoom;
    },

    _appendLeaves: function (result, clusterId, clusterZoom, limit, offset, skipped) {
        var children = this.getChildren(clusterId, clusterZoom);

        for (var i = 0; i < children.length; i++) {
            var props = children[i].properties;

            if (props.cluster) {
                if (skipped + props.point_count <= offset) {
                    // skip the whole cluster
                    skipped += props.point_count;
                } else {
                    // enter the cluster
                    skipped = this._appendLeaves(
                        result, props.cluster_id, clusterZoom + 1, limit, offset, skipped);
                    // exit the cluster
                }
            } else if (skipped < offset) {
                // skip a single point
                skipped++;
            } else {
                // add a single point
                result.push(children[i]);
            }
            if (result.length === limit) break;
        }

        return skipped;
    },

    _addTileFeatures: function (ids, points, x, y, z2, tile) {
        for (var i = 0; i < ids.length; i++) {
            var c = points[ids[i]];
            tile.features.push({
                type: 1,
                geometry: [[
                    Math.round(this.options.extent * (c.x * z2 - x)),
                    Math.round(this.options.extent * (c.y * z2 - y))
                ]],
                tags: c.numPoints ? getClusterProperties(c) : this.points[c.id].properties
            });
        }
    },

    _limitZoom: function (z) {
        return Math.max(this.options.minZoom, Math.min(z, this.options.maxZoom + 1));
    },

    _cluster: function (points, zoom) {
        var clusters = [];
        var r = this.options.radius / (this.options.extent * Math.pow(2, zoom));

        // loop through each point
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            // if we've already visited the point at this zoom level, skip it
            if (p.zoom <= zoom) continue;
            p.zoom = zoom;

            // find all nearby points
            var tree = this.trees[zoom + 1];
            var neighborIds = tree.within(p.x, p.y, r);

            var numPoints = p.numPoints || 1;
            var wx = p.x * numPoints;
            var wy = p.y * numPoints;

            var clusterProperties = null;

            if (this.options.reduce) {
                clusterProperties = this.options.initial();
                this._accumulate(clusterProperties, p);
            }

            for (var j = 0; j < neighborIds.length; j++) {
                var b = tree.points[neighborIds[j]];
                // filter out neighbors that are too far or already processed
                if (zoom < b.zoom) {
                    var numPoints2 = b.numPoints || 1;
                    b.zoom = zoom; // save the zoom (so it doesn't get processed twice)
                    wx += b.x * numPoints2; // accumulate coordinates for calculating weighted center
                    wy += b.y * numPoints2;
                    numPoints += numPoints2;
                    b.parentId = i;

                    if (this.options.reduce) {
                        this._accumulate(clusterProperties, b);
                    }
                }
            }

            if (numPoints === 1) {
                clusters.push(p);
            } else {
                p.parentId = i;
                clusters.push(createCluster(wx / numPoints, wy / numPoints, numPoints, i, clusterProperties));
            }
        }

        return clusters;
    },

    _accumulate: function (clusterProperties, point) {
        var properties = point.numPoints ?
            point.properties :
            this.options.map(this.points[point.id].properties);

        this.options.reduce(clusterProperties, properties);
    }
};

function createCluster(x, y, numPoints, id, properties) {
    return {
        x: x, // weighted cluster center
        y: y,
        zoom: Infinity, // the last zoom the cluster was processed at
        id: id, // index of the first child of the cluster in the zoom level tree
        properties: properties,
        parentId: -1, // parent cluster id
        numPoints: numPoints
    };
}

function createPointCluster(p, id) {
    var coords = p.geometry.coordinates;
    return {
        x: lngX(coords[0]), // projected point coordinates
        y: latY(coords[1]),
        zoom: Infinity, // the last zoom the point was processed at
        id: id, // index of the source feature in the original input array
        parentId: -1 // parent cluster id
    };
}

function getClusterJSON(cluster) {
    return {
        type: 'Feature',
        properties: getClusterProperties(cluster),
        geometry: {
            type: 'Point',
            coordinates: [xLng(cluster.x), yLat(cluster.y)]
        }
    };
}

function getClusterProperties(cluster) {
    var count = cluster.numPoints;
    var abbrev = count >= 10000 ? Math.round(count / 1000) + 'k' :
                 count >= 1000 ? (Math.round(count / 100) / 10) + 'k' : count;
    return extend(extend({}, cluster.properties), {
        cluster: true,
        cluster_id: cluster.id,
        point_count: count,
        point_count_abbreviated: abbrev
    });
}

// longitude/latitude to spherical mercator in [0..1] range
function lngX(lng) {
    return lng / 360 + 0.5;
}
function latY(lat) {
    var sin = Math.sin(lat * Math.PI / 180),
        y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return y < 0 ? 0 :
           y > 1 ? 1 : y;
}

// spherical mercator to longitude/latitude
function xLng(x) {
    return (x - 0.5) * 360;
}
function yLat(y) {
    var y2 = (180 - y * 360) * Math.PI / 180;
    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;
}

function extend(dest, src) {
    for (var id in src) dest[id] = src[id];
    return dest;
}

function getX(p) {
    return p.x;
}
function getY(p) {
    return p.y;
}

},{"kdbush":1}],6:[function(require,module,exports){
var h = require('./helpers');

module.exports = (function() {


	var MapboxBookmarks = function( options ) {
		this.map = h_getProp('map', options );
        this.animSpeed = h_getProp('animSpeed', options );

        if (!this.animSpeed) {
            this.animSpeed = 4000;
        };

        this.mobileCheck = h_getProp('animSpeed', options );

        if (typeof this.mobileCheck != "function") {
            this.mobileCheck = function() {
                return window.matchMedia( '(max-width: 600px)' ).matches
            };
        }

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

					if ( b.locationMobile && self.mobileCheck() ) {
						loc = b.locationMobile;
					}

					if ( b.zoomMobile && self.mobileCheck()) {
						z = b.zoomMobile;
					}

					self.map.flyTo({
						speed: self.animSpeed,
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
				$('body').on('click', target, function( e ) {
					e.preventDefault();
					this.blur();
					b.goto( bookmark.id );
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

},{"./helpers":10}],7:[function(require,module,exports){

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
            console.log("Before:", self.index );
        } else {
            console.log("Before, no index set" );
        }

        if (self.map.type === "leaflet") {
            return self._createLeafletLayers();
        }

        // Create new cluster
        self.index = supercluster({
            radius: self._options.radius,
            maxZoom: self._options.maxZoom
        });

        console.log("After:", self.index );

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
            console.log( self.leafletClusters );
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
            if (force) { console.log( "forcing repaint"); }
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
            console.log( result );
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
                        e.preventDefault();
                        e.stopPropagation();
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
                console.log( newLayer, z );
                console.warn("No newLayer");
            }

		})


	};

	return MapboxCluster;

})();

},{"./helpers":10,"supercluster":5}],8:[function(require,module,exports){
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

},{"./helpers":10}],9:[function(require,module,exports){
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

},{"./MapboxBookmarks":6,"./MapboxCluster":7,"./MapboxMarkers":8,"./helpers":10}],10:[function(require,module,exports){
var _limitNumber = function( number, min, max ) {
    return Math.max( min, Math.min( number, max ) );
};


// save time and checking by creating a wrapper
// to check if a property exists in an object.
// Right now it doesn't do deep checking, but
// we could implement that in future or perhaps
// use dot notation.
//
// This returns undefined if it's not set,
// but not false. Of course if a property was
// set to undefined you won't know this difference,
// but this is good for when you don't care if ti was set
// just that it's not 'truthy'
var _getProp = function( prop, obj ) {

    if ( obj.hasOwnProperty( prop ) ) {
        return obj[prop];
    } else {
        return undefined;
    }

};


module.exports = {
    _getProp: _getProp,
    _limitNumber: _limitNumber
};

},{}],11:[function(require,module,exports){
module.exports = require('./MapboxWrapper.js');

},{"./MapboxWrapper.js":9}]},{},[11])(11)
});