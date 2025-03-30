// This is just a template for future utilities/tools module development.
// This is intended to be used to create top level utlilities that are not referenced by module name,
// but instead directly called (e.g. calling sum(1,2))
//
// put the following require in the using project file, note the () usage.
// import dynamicSort from '../lib/dynamicSort.mjs'
//
// calls are done as: 
// var sortedList = unsortedList.sort(dynamicSort(a,b));
//
export default function dynamicSort(propertyOne, propertyTwo = "") {
    let sortOrderOne = 1;
    if (propertyOne[0] === "-") {
        sortOrderOne = -1;
        propertyOne = propertyOne.substr(1);
    }
    let sortOrderTwo = 1;
    if (propertyTwo[0] === "-") {
        sortOrderTwo = -1;
        propertyTwo = propertyTwo.substr(1);
    }
    return function (a, b) {
        // next line works with strings and numbers; you may want to customize it to your needs
        let result = sortOrderOne * ((a[propertyOne] < b[propertyOne]) ? -1 : (a[propertyOne] > b[propertyOne]) ? 1 : 0);
        if (propertyTwo && !result) {
            result = sortOrderTwo * ((a[propertyTwo] < b[propertyTwo]) ? -1 : (a[propertyTwo] > b[propertyTwo]) ? 1 : 0);
        }
        return result;
    }
}