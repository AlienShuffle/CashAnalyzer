const fs = require('fs');

// if the script has an argument 'logging', then log any differences found.
const logIt = (process.argv[4] && process.argv[4].toLowerCase() == 'logging');

/**
 * Tool to take two files and compare them for differences, returns string 'true' if they are the same.
 * Note, the element (key) 'timestamp' is ignored for the purposes of comparison.
 */
function deepCompare(arg1, arg2) {
    const type1 = Object.prototype.toString.call(arg1);
    const type2 = Object.prototype.toString.call(arg2);
    if (type1 === type2) {
        if (Object.prototype.toString.call(arg1) === '[object Object]' || Object.prototype.toString.call(arg1) === '[object Array]') {
            if (Object.keys(arg1).length !== Object.keys(arg2).length) {
                if (logIt) console.log(`Objects are different lengths`);
                return false;
            }
            return (Object.keys(arg1).every(function (key) {
                return (key == 'timestamp') ? true : deepCompare(arg1[key], arg2[key]);
            }));
        }
        const comp = (arg1 === arg2);
        if (logIt && !comp) console.log(`${arg1} === ${arg2} = ${comp}`);
        return comp;
    }
    if (logIt) console.log(`${type1} <> ${type2}`);
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