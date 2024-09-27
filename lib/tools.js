// This is just a template for future utilities/tools module development.
// This is intended to be used to create top level utlilities that are not referenced by module name,
// but instead directly called (e.g. calling sum(1,2))
//
// put the following require in the using project file, note the () usage.
// require('../lib/tools.js')();
//
// calls are done as: 
// var value = sum(1,2);
//
module.exports = function() { 
    this.sum = function(a,b) { return a+b };
    this.multiply = function(a,b) { return a*b };
    //etc
}
