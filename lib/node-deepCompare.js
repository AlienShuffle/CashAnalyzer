const fs = require('fs');

/**
 * Tool to take two files and compare them for differences, returns string 'true' if they are the same.
 * Note, the element (key) 'timestamp' is ignored for the purposes of comparison.
 */
function deepCompare(arg1, arg2) {
    if (Object.prototype.toString.call(arg1) === Object.prototype.toString.call(arg2)) {
        if (Object.prototype.toString.call(arg1) === '[object Object]' || Object.prototype.toString.call(arg1) === '[object Array]') {
            if (Object.keys(arg1).length !== Object.keys(arg2).length) {
                return false;
            }
            return (Object.keys(arg1).every(function (key) {
                return (key == 'timestamp') ? true : deepCompare(arg1[key], arg2[key]);
            }));
        }
        return (arg1 === arg2);
    }
    return false;
}

try {
    const file1Data = fs.readFileSync(process.argv[2], 'utf8');
    const file2Data = fs.readFileSync(process.argv[3], 'utf8');
    const json1 = JSON.parse(file1Data);
    const json2 = JSON.parse(file2Data);
    console.log(deepCompare(json1, json2))
} catch (err) {
    console.error(err);
}