# Vanguard Advisors ETF collectors

The scheduled job now uses the priority hybrid collector. The opt-in
[API collector](./node-VanguardAdvisorsETF-api-collect.mjs) runs without Chrome
and writes separate comparison files; it does not publish or update history,
downloads, or the scheduled job. Manual hybrid runs share the provider cooldown.

## Scheduled job controls

The main job selects at most four least-recently attempted tickers from
`VanguardETF-funds.txt`. It rotates attempts even on failure so a blocked ticker
does not monopolize every batch. Scheduled and manual hybrid collections share
an exclusive lock and persistent cooldown in `history/hybrid-control`.
At least 15 minutes must elapse after completion of the preceding attempt,
including failures. Force mode does not override this limit. Blocked runs log
an explicit error and do not collect or publish.

Collected facts and yields feed the existing file-based publishers.
Distribution APIs are captured once per selected ticker and the existing
distribution parser/publisher reads those local JSON files without further
provider requests. The latest batch retains NAV history, normalized distributions,
raw responses, and field dates in `history/hybrid-batch`.
The former full scraper and CSV download path are not called by the main job.
The job also holds a separate publishing lock to prevent overlapping job runs.
If a process is forcibly terminated, the provider lock directory can remain;
confirm no collector is running before manually removing that specific lock.

From the repository root, supply a ticker file and a dedicated output directory:

```sh
node VanguardAdvisorsETF/node-VanguardAdvisorsETF-api-collect.mjs \
  --input VanguardAdvisorsETF/VanguardETF-funds.txt \
  --output-dir /tmp/vanguard-api-comparison
```

Start with a small ticker file for comparison before collecting the full list.
Funds are requested sequentially with a one-second pause between funds. Each
request times out after 45 seconds. HTTP 429/5xx responses receive at most two
retries, with a bounded delay; other HTTP, transport, or malformed-data errors
fail the run. Collection completes before comparison files are written.

## Priority hybrid mode

Add `--hybrid` to obtain NAV history, distributions, SEC yield, and distribution
yield from APIs, while using a single shared browser only for the daily YTM/YTW
panel. This mode does not request fees, managed assets, or API fundamentals, and
omits expense ratio, AUM, duration, maturity, and coupon from facts output.
It does not click download buttons or scrape pricing/distribution tables.

Hybrid runs are limited to **four unique tickers** after trimming, uppercasing,
and deduplicating the input file. Longer lists fail before browser launch or
provider requests; they are not silently truncated or automatically batched.
This cap reflects observed provider usage limits, not a guaranteed allowance.
Repeated hybrid runs are also subject to the shared 15-minute cooldown.
The API-only mode remains unchanged.

```sh
node VanguardAdvisorsETF/node-VanguardAdvisorsETF-api-collect.mjs --hybrid \
  --input /tmp/vanguard-four-tickers.txt \
  --output-dir /tmp/vanguard-hybrid-comparison
```

Create the input file with up to four selected tickers, one per line, rather
than passing the full configured fund list.

The browser selects the Daily tab and reads only its associated fundamentals
panel, retaining the displayed as-of date in `metadata.json`. Daily text is
saved in `raw.json`. Missing YTM/YTW is logged and omitted; older monthly API
yields are never substituted. Navigation or malformed daily-panel data fails
the comparison run before output is written. Manual runs write comparison files;
the scheduled main job uses the same hybrid collector and publishes its batch.

Live hybrid validation succeeded for BND, VTEB, VBIL, VTIP, and BNDW.
The daily October 9 values included BND YTM/YTW of 5.49%, VBIL 3.98%,
and BNDW 5.44%/5.43%. VTEB supplied only YTW (4.70%); VTIP supplied
only YTM (2.00%). A subsequent full-list hybrid validation was blocked by
HTTP 404 on BIV's product lookup; prior comparison files remained untouched.

## Sources and output

The initial product HTML supplies `__INITIAL_FUND_DATA__.portId`. Under
`https://advisors.vanguard.com/investments/products/api/funds/<portId>/`:

| Endpoint | Fields |
|---|---|
| `pricing/daily?priceTypeCode=NAV&inceptionDate=2000-11-13` | NAV history, latest NAV |
| `pricing/distributions?hasDistributionYield=false` | Income, capital gains, return of capital |
| `analytics/yields` | SEC yield, distribution yield, YTM, YTW |
| `fees` | Adjusted expense ratio |
| `analytics/fundamentals` | Duration, effective maturity, average coupon |
| `pricing/managed-assets` | ETF/share-class net assets (`fundNetAssetsData`) |

The first four routes are documented in the fintools Advisors implementations.
The fundamentals and managed-assets routes were verified against the Vanguard
frontend and live API responses.

- `facts.json`: existing facts schema and source name, with `asOfDate` from SEC yield.
- `yields.json`: existing yield schema, suitable for comparing with rate output.
- `prices.json`: dated NAV history (not exchange market prices).
- `distributions.json`: existing normalized distribution schema, produced by
  the [existing distribution parser](./node-VanguardAdvisorsETF-distro-update.js).
- `metadata.json`: fund IDs and individual field dates, since yields, NAV,
  fundamentals, and fees can have different effective dates.
- `raw.json`: unmodified endpoint responses and initial fund metadata.

Percentages/coupons are decimal fractions; assets are dollars; duration/maturity
are years. Facts retain existing rounding. Missing optional fields are logged
and omitted, not scraped or invented. Required SEC yield/NAV failures abort
collection. Empty distribution history is reported and represented as empty.

The live October 13 comparison showed SEC yields and NAV matching the existing
scraper for VBIL, BND, VTEB, and BNDW. YTM/YTW were dated August 31 and differed
from the website's displayed values; do not assume API fundamentals are daily.
Fundamentals responses did not supply their own effective dates, so those dates
are deliberately absent from metadata. `aum` uses share-class net assets, not
`assetsUnderManagementData`, which includes other share classes for some funds.
Raw responses retain both asset measures.

The full October 13 live validation collected all 36 configured ETFs, 9,002 NAV
rows, and 2,449 normalized distribution rows. All 22 SEC yields with matching
dates in local scraper history agreed. Optional API omissions were distribution
yield for BNDP/EDV/VTIP/VTP, YTW for VTIP/VTP, and coupon for VBIL.

```sh
node --test VanguardAdvisorsETF/test/*.test.mjs
```
