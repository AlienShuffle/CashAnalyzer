// This is just a template for future utilities/tools module development.
// This is intended to be used to create top level utlilities that are not referenced by module name,
// but instead directly called (e.g. calling sum(1,2))
//
// put the following require in the using project file, note the () usage.
// require('../lib/dynamicSort.js')();
//
// calls are done as: 
// var sortedList = unsortedList.sort(dynamicSort(a,b));
//
module.exports = function () {
  this.dynamicSort = function (propertyOne, propertyTwo = "") {
    var sortOrderOne = 1;
    if (propertyOne[0] === "-") {
      sortOrderOne = -1;
      propertyOne = propertyOne.substr(1);
    }
    var sortOrderTwo = 1;
    if (propertyTwo[0] === "-") {
      sortOrderTwo = -1;
      propertyTwo = propertyTwo.substr(1);
    }
    return function (a, b) {
      // next line works with strings and numbers; you may want to customize it to your needs
      var result = sortOrderOne * ((a[propertyOne] < b[propertyOne]) ? -1 : (a[propertyOne] > b[propertyOne]) ? 1 : 0);
      if (propertyTwo && !result) {
        result = sortOrderTwo * ((a[propertyTwo] < b[propertyTwo]) ? -1 : (a[propertyTwo] > b[propertyTwo]) ? 1 : 0);
      }
      return result;
    }
  }
  // this function is untested.
  this.insertionSort = function (arr, Property) {
    for (let i = 1; i < arr.length; i++) {
      let currentObj = arr[i];
      let currentValue = arr[i][Property];
      let j;
      for (j = i - 1; j >= 0 && arr[j][Property] > currentValue; j--) {
        arr[j + 1] = arr[j];
      }
      arr[j + 1] = currentObj;
    }
    return arr;
  }
}
