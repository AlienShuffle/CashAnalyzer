// cache.gs - internal functions related to managing caching, mostly calculating useful TTL values.
// v12 - baselined functional from deployment v12 and later.
// v50 - update for after hours max of 4.

/**
 * Calculate an age on the quote and use that to estimate how long it may remain useful in the cache (in seconds). 
 * Returns {integer} TTL in seconds.
 * 
 * @param {"1/2/2025 13:10"} tradetime used for quote aging calculations.
 */
function cacheCalcTTL_(t) {

  // get the time as it is known for the markets.
  const nycDate = timeGetNYCTime_();

  // get the time and day of the most recent trade of the reference ticker symbol, time passed in as a parameter.
  // if t is unset, we use midnight yesterday as a default.
  let tradetime;
  if (t) {
    tradetime = new Date(Date.parse(t));
  } else {
    tradetime = new Date;
    tradetime.setHours(0);
    tradetime.setMinutes(0);
  }
  const tradetimeDayOfMonth = tradetime.getDate();
  const tradetimeMonth = tradetime.getMonth();
  const tradetimeYear = tradetime.getFullYear();

  // If last trade is within an hour of current time, we assume market is open.
  if (Math.abs(tradetime.getTime() - nycDate.getTime()) < (1000 * 60 * 60)) {
    return 20 * 60;
  }

  // breakdown NYC time.
  const nycMinutes = nycDate.getMinutes();
  const nycHours = nycDate.getHours();
  const nycDayOfWeek = nycDate.getDay();   // Day of Week.
  const nycDayOfMonth = nycDate.getDate(); // The day of the month.
  const nycMonth = nycDate.getMonth();
  const nycYear = nycDate.getFullYear();

  // If it is the weekend, let's cache for 9 hours.
  // This will force refreshes on Monday morning at 9 at the latest.
  if (nycDayOfWeek == 0 || nycDayOfWeek == 6)
    return (nycHours < 9) ? (9 - nycHours) * 60 * 60 : (24 + 9 - nycHours) * 60 * 60;

  // If the time is other than 00:00, it is actively updated during the day.
  // Note, this still lets most mutual fund queries go through, but I haven't figured out a way to identify all of them.
  if (tradetime.getHours()) {

    // if the trade date is at least 14 days ago, no need to work hard during the trading day.
    if ((nycDate - tradetime) > (1000 * 60 * 60 * 24 * 14)) {
      // If time is before 3pm, update expected between 6:45 and 8pm today.
      // Update every 30 minutes between 7pm and 9pm, other hours, evenings, go 4 just in case.
      if (nycHours < 18)
        return (18 - nycHours) * 60 * 60;
      if (nycHours == 18)
        return (60 - nycMinutes) * 60;
      if (nycHours > 18 && nycHours <= 20)
        return 30 * 60;
      return 4 * 60 * 60;
    }

    // If current time is between 7AM and 9AM, then the market could be in pre-open
    // ex-Dividend changes often show up then.
    if (nycHours >= 7 && nycHours < 9) {
      return 30 * 60;
    }

    // Calculate the remaining time before market open at 9:30
    // 10 minute grace period to allow to start.
    if (nycHours == 9 && nycMinutes < 40) {
      return (40 - nycMinutes) * 60;
    }

    // We are in trading hours and we have the stupid yahoo MF quote, let's just push it to 4pm.
    if (tradetimeDayOfMonth == nycDayOfMonth && tradetime.getHours() == 8) {
      // If time is before 5pm, update expected between 5:45 and 7pm today.
      // Update every 20 minutes between 6pm and 9pm, other hours, evenings, go 4 just in case.
      if (nycHours < 17)
        return (17 - nycHours) * 60 * 60;
      if (nycHours == 17)
        return (60 - nycMinutes) * 60;
      if (nycHours > 17 && nycHours <= 20)
        return 20 * 60;
      // Otherwise make it 4 hours.
      return 4 * 60 * 60;
    }

    // If we are in trading hours but no current trade, then 30 minutes to catch when it trades.
    if (nycHours < 16)
      return 30 * 60;

    // If current time is between 4pm and 7pm,
    // market could be in the process of closing the books for today.
    if (nycHours >= 16 && nycHours < 19) {
      // Let's calculate the lesser of 60 minutes or the remaining time before 7pm true up.
      return (nycHours == 18) ? (60 - nycMinutes) * 60 : 60 * 60;
    }

    // If tradetime is < today and current time is between 7pm and 9pm,
    // use 20 minutes to ensure we have the latest and final daily update.
    if ((tradetimeYear <= nycYear && tradetimeMonth <= nycMonth && tradetimeDayOfMonth < nycDayOfMonth) &&
      (nycHours >= 19 && nycHours < 22)) {
      return 20 * 60;
    }

    // Otherwise make it 3 hours.
    return 3 * 60 * 60;
  }

  // if we get here, it is a date only value, then set to update after 4pm only if the date is earlier than today.
  if (tradetimeYear <= nycYear && tradetimeMonth <= nycMonth && tradetimeDayOfMonth < nycDayOfMonth) {
    if (nycHours < 17)
      return (17 - nycHours) * 60 * 60;
    if (nycHours == 17)
      return (60 - nycMinutes) * 60;
    if (nycHours > 17 && nycHours <= 20)
      return 20 * 60;
  }
  // Fallback, make it 3 hours.
  return 3 * 60 * 60;
}

/**
 * Calculate a TTL that will end at the hour provided in the parameter (in seconds)..
 * @param {7} hour used to set TTL to end at. Returns TTL in seconds.
 */
function cacheCalcTTLAfterHour_(hour) {
  // get the time as it is known for the markets.
  const nycDate = timeGetNYCTime_();
  // breakdown NYC hour.
  const nycHours = nycDate.getHours();
  // calculate hours until parameter hour.
  let delta = (hour < nycHours) ? (24 - nycHours + hour) : (hour - nycHours);
  // putting in hack to ensure time is never greater than 4 hours to see if the reload issue is improved.
  // 8/7/23 - turned off, it actually seemed to make reloads worse. I think due to too many calls to the drive service.
  //delta = (delta > 4) ? 4 : delta;
  // convert to seconds and return;
  return 60 * 60 * delta;
}

function timeGetNYCTime_() {
  // current date in local timezone with seconds trimmed.
  const currDate = new Date();
  currDate.setSeconds(0);
  currDate.setMilliseconds(0);

  // This is considered unsafe, but it appears to work.
  // It basically gets a string representing the current time in NYC timezone regardless of
  // the current time zone defined in the user's environment and converts to a new Date thus showing the
  // local time as it is seen in NYC, not here, wherever here is.....
  const nycDateString = currDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
  return new Date(Date.parse(nycDateString));
}

/************* These functions are used for instrumenting the the TTL calculations for analysis purposes. ***********/

// log TTL calculations to a worksheet for analysis of
// effectiveness. they are put in a cache themselves and I
// will pull them via a function call in the spreadsheet.
function cacheLogTTL_(tag, tradetime, ttl) {
  // there is overhead here, put in a return if you want instrumenting turned off (production)
  // these caching items actually seem to add significant overhead to the system and impact response times.
  return;
  const cache = CacheService.getDocumentCache();
  const resp = [tradetime, timeGetNYCTime_(), ttl];
  cache.put("tts-" + tag, JSON.stringify(resp), ttl + (10 * 60));
}

/**
 * Given a known cache tag, return the logged TTL and times if recorded, otherwise null.
 * Returns [tradetime, nycTime, ttl]
 * 
 * @param {"tag-string"} tag cache tag.
 */
function cacheGetTTL_(tag) {
  const cache = CacheService.getDocumentCache();
  const cacheVal = cache.get("tts-" + tag);
  if (cacheVal) {
    let resp = JSON.parse(cacheVal);
    if (resp) {
      if (resp[0]) resp[0] = new Date(resp[0]);
      if (resp[1]) resp[1] = new Date(resp[1]);
      return [resp];
    }
  }
}

function inspectCaches() {
  const keys = ['archiveAvailableTickers','archive-getIDs'];

  const docCache = CacheService.getDocumentCache();
  if (!docCache) {
    Logger.log('empty docCache!');
  } else {
    Logger.log('docCache:');
    Logger.log(docCache.getAll(keys));
  }
  const userCache = CacheService.getUserCache();
  if (!userCache) {
    Logger.log('empty userCache!');
  } else {
    Logger.log('userCache:');
    Logger.log(userCache.getAll(keys));
  }
  const scriptCache = CacheService.getScriptCache();
  if (!scriptCache) {
    Logger.log('empty scriptCache!');
  } else {
    Logger.log('scriptCache:');
    Logger.log(scriptCache.getAll(keys));
  }
}

/**
 * Add seconds to the input startTime and return the new time the cache will timeout.
 * @param {"11-26-2021 13:59:00"} startTime current Time used to calcluate the original TTL.
 * @param {"11-26-2021 13:59:00"} ttlSecs TTL calculated originally.
 **/
function cacheTTLTimeout_(startTime, ttlSecs) {
  const t = new Date(startTime);
  t.setSeconds(t.getSeconds() + ttlSecs);
  return t;
}