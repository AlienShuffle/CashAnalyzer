# TIPS reference metadata

Run `node TIPSmeta/node-TIPSmeta-update.js` from the repository root to emit the
same seven-column CSV consumed by the nominal/TIPS report pipeline.

The collector now includes **matured as well as outstanding TIPS**. The official
[Treasury auction API](https://www.treasurydirect.gov/TA_WS/securities/search?type=TIPS&format=json)
supplies historical issues, original dated dates, original terms, coupons, and
reference CPI on the original dated date. Reopenings are deduplicated by CUSIP;
the earliest issue record supplies the original dated date, not a reopening's
later coupon-period dated date.

The outstanding records are cross-checked against the official
[Fiscal Data TIPS summary](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/tips_cpi_data_summary).
Coupon, maturity, original dated date, and base CPI disagreements fail explicitly.
Coupon percentages are converted to decimal rates. API failures, missing
mandatory values, unsupported terms, and additional summary pages are errors,
not partial successful outputs.

The normal publication job still writes `Treasuries/TIPSmeta.csv`. Including
matured records does not introduce them into current fits: those fits require
matching positive quotes and future maturities. Historical fits can now recover
the formerly missing bonds. This is reference metadata, not a historical
quote source; quote dates still govern which issues enter a replay.
