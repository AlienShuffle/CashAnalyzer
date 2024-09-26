// This is just a template for future module development.
// This is intended to be used to create top level utlilities that are not referenced by module name,
// but instead directly called (e.g. calling sum(1,2))
//
// put the following require in the using project file, note the () usage.
// const module = require('../lib/module.js');
// 
// calls look like:
// const fooValue = module.foo();
//
module.exports = {
    foo: function () {
      return true;
    },
    bar: function () {
      return false;
    }
  };