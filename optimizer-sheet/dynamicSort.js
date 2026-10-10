// hist.dynamicSort.gs

/**
 * Generic dynamic sort function for 1 or 2 properties in a collection of objects.
 * Example calls array.sort('ticker') or array.sort('ticker','year') or array.sort ('-yield')
 * prepending the name with a - sign will make the sort descending. 
 * @param string propertyOne first object property name to sort
 * @param string= propertyTwo optional second property to allow for multi-field sorting.
 */
function dynamicSort(propertyOne, propertyTwo = "") {
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
