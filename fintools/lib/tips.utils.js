// tips.utils.gs

/**
 * Calculate the SA Factor for date. If the date provided is before the max REFCPI date,
 * return the BLS defined ratio. If after the max REFCPI, then lookup the most recent month/day reported and use that value.
 *
 * @param {Date} searchDate date
 * 
 * @return {number}
 * @customfunction
 */
function tipsGetFactor(searchDate) {
  if (
    typeof searchDate === 'undefined' ||
    searchDate === null ||
    searchDate === ''
  )
    return null;
  const date = mydateNormalize_(searchDate);

  const makeMMDD = d => 'M' + (d.getMonth() + 1 + '').padStart(2, '0') +
    (d.getDate() + '').padStart(2, '0');
  const dateMMDD = makeMMDD(date);

  const rows = cloudGetCachedREFCPI_();
  for (let i = 0; i < rows.length; i++) {
    const rd = rows[i].date;
    if (mydateIsEqual_(rd, date))
      return rows[i].saFactor;
    if (mydateLessThan_(rd, date))
      break;
  }
  // find the most recent MMDD that matches the search date.
  for (let i = 0; i < rows.length; i++) {
    const mmdd = makeMMDD(rows[i].date);
    if (mmdd === dateMMDD)
      return rows[i].saFactor;
  }
  return null;
}

/**
 * Return that reported REFCPI for date. If the date provided is before the max REFCPI date,
 * return the BLS defined ratio. If after the max REFCPI, then return null.
 * This always reports the BLS NSA CPI value (not seasonally adjusted).
 * This may have a limited history to improve performance so dated date REFCPI may not be found here.
 *
 * @param {Date} searchDate date
 * 
 * @return {number}
 * @customfunction
 */
function tipsGetRefCpi(searchDate) {
  const date = mydateNormalize_(searchDate);
  const rows = cloudGetCachedREFCPI_();

  for (let i = 0; i < rows.length; i++) {
    const rd = mydateNormalize_(rows[i].date);
    if (mydateIsEqual_(rd, date))
      return rows[i].refCpiNSA;
    if (mydateLessThan_(rd, date))
      break;
  }
  return null;
}

/**
 * Return the maximum REFCPI date in the cached table as YYYY-MM-DD text.
 *
 * @return {string} Date only, without a time or timezone.
 * @customfunction
 */
function tipsGetMaxRefCpiDate() {
  const rows = cloudGetCachedREFCPI_();
  const date = mydateNormalize_(rows[0].date);
  if (date === null || Number.isNaN(date.getTime()))
    throw new Error('Invalid maximum REFCPI date');
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}