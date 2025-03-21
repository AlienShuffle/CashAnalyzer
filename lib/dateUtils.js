// This is the CommonJS module for data utilities. I am trying to retire this file with the ES module implementation.
//
// put the following require in the using project file.
// const du = require('../lib/dateUtils.js');
// 
// calls look like:
// const fooValue = du.getISOString(new Date);
//
module.exports = {
    // returns true if startDate is before endDate
    dateLessThan: function (startDate, endDate) {
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
    },
    // returns true if startDate is before endDate
    dateEqualTo: function (startDate, endDate) {
        const sYear = startDate.getFullYear();
        const eYear = endDate.getFullYear();
        if (sYear != eYear) return false;
        const sMonth = startDate.getMonth();
        const eMonth = endDate.getMonth();
        if (sMonth != eMonth) return false;
        const sDate = startDate.getDate();
        const eDate = endDate.getDate();
        if (sDate != eDate) return false;
        return true;
    },
    // how many 24 hour periods between these two date/time?
    daysBetween: function (startDateTime, endDateTime) {
        function treatAsUTC(dateTime) {
            const result = new Date(dateTime);
            result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
            return result;
        }
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        return ((treatAsUTC(endDateTime).getTime() - treatAsUTC(startDateTime).getTime()) / millisecondsPerDay);
    },
    getDateFromYYYYMMDD: function (d) {
        // assumes: YYYY-MM-DD, avoids time zone issues by forcing date, not assume a UTC date/time.
        return new Date(parseInt(d.substring(0, 4)), parseInt(d.substring(5, 7)) - 1, parseInt(d.substring(8, 10)))
    },
    getDatePlusOne: function (d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    },
    getISOString: function (d) {
        if (!d) return "";
        return d.getFullYear().toString() + '-' +
            (d.getMonth() + 1).toString().padStart(2, '0') + '-' +
            d.getDate().toString().padStart(2, '0');
    },
    getMMDDYYYYString: function (d) {
        if (!d) return "";
        return (d.getMonth() + 1).toString() + '/' + d.getDate().toString() + '/' + d.getFullYear().toString();
    },
};
