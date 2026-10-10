// misc.gs - random utilities used by more than one other sub-library (not public, only internal).
// v12 - baselined functional from deployment v12 and later.
// v50 baseline.
// v81 - adjusted exception throw text on json parse failures.

// slices up the .CVS file contents stored in str and creates array that is n rows long and y columns wide.
function csvToMatrix_(str, delimiter = ",") {
  // use split to create an array of each csv value row
  const rows = str.slice().split("\n");

  // Map the rows, split values from each row into an array
  const matrix = rows.map(function (row) {
    return row.split(delimiter);
  });
  return matrix;
}

// slices up a CVS file contents stored in str and creates array using header row as row level items.
function csvToArray_(str, delimiter = ",") {

  // slice from start of text to the first \n index
  // use split to create an array from string by delimiter
  const headers = str.slice(0, str.indexOf("\n")).split(delimiter);

  // slice from \n index + 1 to the end of the text
  // use split to create an array of each csv value row
  const rows = str.slice(str.indexOf("\n") + 1).split("\n");

  // Map the rows
  // split values from each row into an array
  // use headers.reduce to create an object
  // object properties derived from headers:values
  // the object passed as an element of the array
  const array = rows.map(function (row) {
    const values = row.split(delimiter);
    const el = headers.reduce(function (object, header, index) {
      object[header] = values[index];
      return object;
    }, {});
    return el;
  });
  return array;
}

/// DATE Functions

// take two dates and return true if the start date is before the end date.
function duDateLessThan_(startDate, endDate) {
  const sYear = startDate.getFullYear();
  const eYear = endDate.getFullYear();
  if (sYear < eYear) return true;
  if (sYear > eYear) return false;
  const sMonth = startDate.getMonth();
  const eMonth = endDate.getMonth();
  if (sMonth < eMonth) return true;
  if (sMonth > eMonth) return false;
  const sDate = startDate.getDate();
  const eDate = endDate.getDate();
  if (sDate < eDate) return true;
  return false;
}

// parse out date string and create a javascript Date object. Invalid strings return "".
function duGetDateFromYYYYMMDD_(ds) {
  if (!ds)
    return "";
  // format is YYYY-MM-DD (length 10)
  if (ds.length == 10)
    return new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(5, 7)) - 1, parseInt(ds.substring(8, 10)));
  // format is YYYYMMDD (length 8)
  if (ds.length == 8)
    return new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(4, 6)) - 1, parseInt(ds.substring(6, 8)));
  return "";
}

//function test(ds="01021999"){ console.log(dateGetFromMMDDYYYYC(ds));}
function duDateGetFromMMDDYYYY_(ds) {
  if (!ds)
    return "";
  // format is MM-DD-YYYY (length 10)
  if (ds.length == 10)
    return new Date(parseInt(ds.substring(6, 10)), parseInt(ds.substring(0, 2)) - 1, parseInt(ds.substring(3, 5)));
  // format is MMDDYYYY (length 8)
  if (ds.length == 8)
    return new Date(parseInt(ds.substring(4, 8)), parseInt(ds.substring(0, 2)) - 1, parseInt(ds.substring(2, 4)));
  return "";
}

/**
 * Returns a formatted string of the form MM/DD/YYYY from the supplied date..
 * @param {object} date date object to be formatted
 * @return {string} date_string MM/DD/YYYY
 */
function duGetMMDDYYYYString_(date) {
  if (!date) return "";
  if (!(typeof date === 'object')) return ""
  return ((date.getMonth() + 1 + '')).padStart(2, '0') +
    '/' +
    (date.getDate() + '').padStart(2, '0') +
    '/' +
    date.getFullYear();
}

function duGetDateDelta_(date, delta) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

function duGetISOString_(date) {
  //Logger.log(date);
  return date.getFullYear() +
    '-' +
    ((date.getMonth() + 1 + '')).padStart(2, '0') +
    '-' +
    (date.getDate() + '').padStart(2, '0');
}

/**
 * Converts a epoch seconds date number and returns date object.
 * @param {12354} secs secondssince epoch.
 * @return {Date}
 */
function duDateTimeFromSecs_(secs) {
  const t = new Date(1970, 0, 1); // Epoch
  t.setSeconds(secs);
  return t;
}

// extract the actual JSON string from a messy pre-amble/appendix.
function jsonExtractString_(responseText) {
  // The response text may include some extraneous stuff at the beginning and end, so remove it.
  // Might be something like angular.callbacks._u({JSON-content}).

  const idx1 = responseText.indexOf("{");                               // search first JSON curly brace
  const idx2 = responseText.lastIndexOf("}");                           // search last JSON curly brace
  if ((idx1 < 0) || (idx2 <= 0))
    throw "No JSON content retrieved";

  // now lets get rid of any extraneous header and/or trailer
  // at the very minimum, we'll get two curly braces, hence something the parser can play with...
  const len = idx2 + 1;
  if ((idx1 > 0) || (len < responseText.length))
    responseText = responseText.substr(idx1, len - idx1);
  return responseText;
}

/**
 * defensive parsing of a JSON string
 */
function jsonParse_(jsonText) {
  try {
    var json = JSON.parse(jsonText);
  }
  catch (err) {
    Logger.log("JSON parse Error!\n");
    throw "Error occured trying to parse text as JSON: " + err + '\ntext below:\n' + jsonText;
  };
  if (!json) {
    throw "Nothing obtained after attempting to parse as JSON";
  }
  return json;
}

// this is published in ssTools.gs for other users.
/**
 * defensive parsing of a JSON string, cleans crud off the ends of the string.
 * @param {string} jsonText JSON string.
 * @return {array} returns parsed array from the JSON string.
 * @customfunction
 */
function jsonExtractAndParse_(s) {
  return jsonParse_(jsonExtractString_(s));
}

// tests an object reference and returns the object or "" if invalid.
function safeObjectRef_(obj) {
  if (typeof obj === "undefined") {
    //Logger.log("undefined!\n");
    return "";
  }
  return obj;
}