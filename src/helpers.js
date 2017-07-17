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
