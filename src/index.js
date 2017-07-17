(function() {
  var MapboxWrapper = require('./MapboxWrapper');

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
    module.exports = MapboxWrapper;
  else
    window.Validator = MapboxWrapper;
})();
