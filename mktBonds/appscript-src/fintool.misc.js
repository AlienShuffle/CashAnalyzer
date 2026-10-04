// excerpt from fintools.misc.gs

// parse out date string and create a javascript Date object. Invalid strings return "".
// 6-SEP-26 - this was updated to handle full ISO strings more resliently from the original fintools library.
/**
 * @param {string} ds date string
 * @return {date} 
 */
function duGetDateFromYYYYMMDD_(ds) {
  if (!ds)
    return "";
    // format is YYYYMMDD (length 8)
  if (ds.length == 8)
    return new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(4, 6)) - 1, parseInt(ds.substring(6, 8)));
  // format is YYYY-MM-DD or YYYY-MM-DDThh:mm:ss.000Z (length at least 10)
  if (ds.length >= 10)
    return new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(5, 7)) - 1, parseInt(ds.substring(8, 10)));
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