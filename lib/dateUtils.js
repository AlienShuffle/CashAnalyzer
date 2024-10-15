// This is just a template for future module development.
// This is intended to be used to create top utilities referenced by module name.
//
// put the following require in the using project file.
// const du = require('../lib/dateUtils.js');
// 
// calls look like:
// const fooValue = du.foo();
//
module.exports = {
    getDateFromYYYYMMDD: function (ds) {
        return new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(5, 7)) - 1, parseInt(ds.substring(8, 10)))
    },
    getISOString: function (d) {
        return d.getFullYear().toString() + '-' +
            (d.getMonth() + 1).toString().padStart(2, '0') + '-' +
            d.getDate().toString().padStart(2, '0');
    },
    getDatePlusOne: function (d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    },
};
