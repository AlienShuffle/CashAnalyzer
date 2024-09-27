// This is just a template for future module development.
// This is intended to be used to create top utilities referenced by module name.
//
// put the following require in the using project file.
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
