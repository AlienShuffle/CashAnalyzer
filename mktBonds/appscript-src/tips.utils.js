// tips.utils.gs

/**
 * Calculate the SA Factor for date. Uses KevinM's refCpi table as a source. This could be redirected to mine as well.
 * But to appease the TIPS gods I'll use his to ensure compatibility for results. if the date provided is before the max REFCPI date,
 * return the BLS defined ratio. If after the max REFCPI, then lookup the most recent month/day reported and use that value.
 *
 * @param {Date} searchDate date
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * 
 * @return {number}
 * @customfunction
 */
function tipsGetFactor(searchDate, forceRefresh = false) {
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

  const rows = cloudGetCachedAerokamRefCpi(forceRefresh);
  for (let i = 0; i < rows.length - 1; i++) {
    const rd = rows[i].date;
    if (mydateIsEqual_(rd, date))
      return rows[i].saFactor;
    if (mydateLessThan_(rd, date))
      break;
  }
  // find the most recent MMDD that matches the search date.
  for (let i = 0; i < rows.length - 1; i++) {
    const mmdd = makeMMDD(rows[i].date);
    if (mmdd === dateMMDD)
      return rows[i].saFactor;
  }
  return null;
}

/**
 * Return that reported REFCPI for date. Uses KevinM's refCpi table as a source. This could be redirected to mine as well.
 * But to appease the TIPS gods I'll use his to ensure compatibility for results. if the date provided is before the max REFCPI date,
 * return the BLS defined ratio. If after the max REFCPI, then return null.
 * This always reports the BLS NSA CPI value (not seasonally adjusted).
 * This has a limited history to improve performance so dated date REFCPI are not likely to be found here.
 *
 * @param {Date} searchDate date
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * 
 * @return {number}
 * @customfunction
 */
function tipsGetRefCpi(searchDate, forceRefresh = false) {
  const date = mydateNormalize_(searchDate);
  const rows = cloudGetCachedAerokamRefCpi(forceRefresh);

  for (let i = 0; i < rows.length - 1; i++) {
    const rd = rows[i].date;
    if (mydateIsEqual_(rd, date))
      return rows[i].refCpiNSA;
    if (mydateLessThan_(rd, date))
      break;
  }
  return null;
}

/**
 * Return that maximum REFCPI date. Uses KevinM's refCpi table as a source. This could be redirected to mine as well.
 * But to appease the TIPS gods I'll use his to ensure compatibility for results.
 * This always reports the BLS NSA CPI value (not seasonally adjusted).
 *
 * @param {boolean} forceRefresh [OPTIONAL, default = FALSE]. true forces a new table, not use any available cache.
 * 
 * @return {Date}
 * @customfunction
 */
function tipsGetMaxRefCpiDate(forceRefresh = false) {
  const rows = cloudGetCachedAerokamRefCpi(forceRefresh);
  return rows[0].date;
}