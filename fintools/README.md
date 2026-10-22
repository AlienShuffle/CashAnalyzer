# fintools Apps Script library

## Source layout

- [lib/](./lib/) is the authoritative Google Apps Script implementation,
  including the Treasury/TIPS toolkit. Existing fintools market-data APIs and
  shared helpers remain in place.
- [wrapper/](./wrapper/) contains public adapters for consuming scripts. Each
  adapter forwards to the library identifier `fintools`. Copy the required
  wrapper files into a consumer project, not into the library itself.
- [wrapper-tips/](./wrapper-tips/) is a parallel development-mode worksheet
  containing all migrated financial wrappers and the three Treasury adapters,
  without the generic market-data wrapper families.
- [toolkit-app-script-src/](../mktBonds/toolkit-app-script-src/) remains the
  existing worksheet's deployment source. It contains synchronized financial
  wrappers, its manifest, and the existing TIPS Controls menu. It no longer
  contains local financial implementations or duplicate cache helpers.

The migration adds 39 public entry-point wrappers: 33 spreadsheet custom
functions and six documented script-callable zero-curve helpers. With its
three existing Treasury custom functions, the toolkit retains all 36 worksheet
functions. Names, argument defaults, return shapes, and financial calculations
are preserved. Private trailing-underscore helpers remain inside the library.
The existing fintools wrapper families retain their callable names and now
generate from the library's public JSDoc, including a correctly spelled
`bankGetCachedAccountTypes` alias alongside `bankGetCachedAccounTypes`.

## Maintaining wrappers

Edit implementations and their public JSDoc in [lib/](./lib/), then
run from the repository root:

```sh
node fintools/sync-wrappers.mjs --write
node fintools/sync-wrappers.mjs --check
node --test mktBonds/test/*.test.mjs
```

[sync-wrappers.mjs](./sync-wrappers.mjs) generates all ten domain `fin.*`
wrapper families and the migrated financial wrappers from library sources (all
named uniformly with the `fin.*` prefix).
It maintains identical financial worksheet copies and the worksheet's three
Treasury adapters in both the toolkit and [wrapper-tips/](./wrapper-tips/).
Other legacy families are not copied into these financial projects.
Do not edit generated
files directly. The generator supports the migrated APIs' simple named
parameters and literal defaults; new signatures must remain compatible or
extend the generator and its tests.

Node regression/parity tests execute the actual fintools implementations.
[fintools-integration.test.mjs](../mktBonds/test/fintools-integration.test.mjs)
checks merged-source loading, declaration collisions, wrapper coverage and
synchronization, argument/default forwarding, output identity, error
propagation, and library-to-worksheet calculation/cache boundaries.
[fintools-legacy.test.mjs](../mktBonds/test/fintools-legacy.test.mjs) exercises
legacy API documentation/exposure, real cache helpers, service stubs, and
fresh/cached/forced output contracts.

## Legacy API contracts and compatibility

Public library JSDoc and generated wrappers describe schemas, units, defaults,
headers, sources, and examples. Rates, APYs, expense ratios, and price changes
are decimals, not percentage points. Quote APIs return one-row two-dimensional
tables; Yahoo expense ratio is a scalar number or `"n/a"`. Source dates are
Date values on both fresh and cached reads. Yahoo quote dates preserve the
epoch instant; the worksheet controls the displayed timezone.

CNBC stock/ETF prices try the header quote first, then the 5D and 1M charts.
Header quotes return `[[asOf, price, changePct]]`, with decimal `changePct` or
`""` when unavailable; chart fallbacks retain `[[asOf, price]]`. Only the stock/
ETF 1M fallback adjusts the Date to 16:00 in the runtime's local timezone.
Mutual funds try the header quote then the 1M chart and always return
`[[asOf, price]]`. Both APIs use the cache by default and accept explicit refresh.
Missing or invalid price/date data is logged before trying the next source;
retrieval and JSON parsing failures propagate rather than being hidden.

The internal `cnbcDatedPriceFromChart_(ticker, period, priceDate)` helper returns
`[[asOf, price]]` for the latest valid trading bar on or before the requested
calendar day. The returned `asOf` is the actual trade date, not the requested
date. `period` defaults to `"1Y"`; `priceDate` accepts
a Date, `M/D/YYYY`, or `YYYY-MM-DD` in the runtime's local timezone (and retains
the copied default `"10/01/2026"`). Midnight daily bars are valid; intraday bars
must be within 09:30 inclusive to 16:05 exclusive. Weekends, holidays and days
without valid bars use the latest earlier valid bar within the selected period.
No later date is used and the chart period is not automatically expanded.
If no qualifying bar exists, the helper logs and returns `undefined`.
Invalid dates throw before fetching.

Use the public custom function
`=cnbcGetCachedDatedPrice("VTI", "2026-10-01", "1Y", false)` for cached dated
prices. The date is required; the chart period defaults to `"1Y"` and the final
`forceRefresh` argument defaults to `false`. A Sheets date cell can replace the
date string. Numeric Excel dates in the standard 1900 date system are also
accepted (for example, `46296` means October 1, 2026). Fractional times are
ignored without timezone shifts. Serial 60 (Excel's fictitious February 29,
1900), nonpositive serials and dates beyond year 9999 are rejected; the Excel
1904 date system is not supported. Dates passed across library boundaries are
accepted as well. Cache keys include the ticker, period and normalized calendar date;
equivalent date formats share a cache entry. Like the other CNBC price APIs,
this uses document cache with script-cache fallback, the shared bounded TTL
calculator, and restores Date values on cache reads. Missing prices throw
without being cached; retrieval and parsing failures propagate.

Intentional corrections to previously broken or misleading behavior:

- `bankGetCurrentRateHistoryFileContents(bank, account)` requires the account;
  its old wrapper incorrectly treated argument two as a refresh boolean.
  Both raw bank-file APIs always fetch and have no refresh parameter.
- `treasuryGetCachedRecentTBillDiscounts()` (renamed from
  `treasuryGetCachedRecentTBillCoupons()`, which remains as an alias; bills pay
  no coupons) now uses the cache by default.
- `treasuryGetCachedTBillDiscounts(yearOrMonth)` replaces
  `treasuryGetCachedTBillCoupons(yearOrMonth)`, which remains as an alias
  returning the same bank-discount rates.
- Omitting the CMT year now selects the current year, not 2023. CMT `YYYYMM`
  selects the full year; T-bill `YYYYMM` uses the month-specific endpoint.
- Unknown Vanguard tickers/invalid column indices and missing named ranges
  throw informative errors instead of silently returning `undefined`/`""`.
- Empty requested bank/yield history throws explicitly. Cloud History
  propagates retrieval/parse errors rather than returning misleading ticker
  error text; failures are not cached. History gap filling carries forward
  observations only between available dates, and is documented.
- `ssTrackRangeUses` batch-reads the used range and matches exact
  case-insensitive identifier tokens, ignoring quoted strings/sheet names and
  function names. It is not a formula parser and does not resolve `INDIRECT`.
  A1 output supports columns beyond AZ.
- `ssSetNamedRangeValue` remains script/menu-callable but is no longer
  advertised as a worksheet custom function (custom functions cannot write
  arbitrary cells). `buildFidelityFundListTable` also remains script-callable;
  a cold cache may require one request per fund, so use it from a script/menu
  rather than a time-limited worksheet formula.

Shared cache calculators bound expiry to 1-21,600 seconds, including the
formerly multi-day Yahoo/Vanguard/Fidelity requests. Banks and Cloud History
pass expiry through `Cacher`'s options object. Cacher child chunks also respect
the six-hour limit. No multi-day persistence store was added; all cache entries
are best-effort and can be evicted early.

Changes require uploading the library and regenerated wrappers. Smoke-test
with the generic development-mode consumer before publishing a new version;
the cross-account toolkit keeps its current pin until a new version is
published and pinned (see [Release script](#release-script)).

## Development and deployment

- The generic [wrapper manifest](./wrapper/appsscript.json) uses version `"0"`
  with `developmentMode: true`. It is the same-account smoke-test consumer and
  tests the library's saved HEAD.
- The [TIPS wrapper manifest](./wrapper-tips/appsscript.json) also uses version
  `"0"` with `developmentMode: true`, independently of the generic worksheet.
- The [worksheet manifest](../mktBonds/toolkit-app-script-src/appsscript.json)
  pins a published library version with development mode disabled (omitting
  `developmentMode` also defaults to disabled). It supports regression testing
  from the worksheet's separate Google account with access to the library.

Development mode uses the library's saved HEAD and requires editor access to
the library; published-library access alone is insufficient.

Deployment order:

1. Upload/save [lib/](./lib/) into the existing fintools library project.
2. Smoke-test the saved library HEAD with the same-account generic wrapper.
   Then publish a new library version for cross-account regression testing.
   Pin the worksheet manifest to that version with development mode disabled;
   leave the generic wrapper in development mode.
3. Upload the worksheet's wrapper-only
   [toolkit-app-script-src/](../mktBonds/toolkit-app-script-src/) source,
   removing the old implementation/helper files from that Apps Script project.
   Ensure the dependency is named `fintools` and test representative worksheet
   formulas, cache refreshes, and the TIPS Controls menu.

Local VM tests cannot certify Google Sheets authorization, library access, or
execution-time limits.

### Release script

After committing, run [clasp-release.sh](./clasp-release.sh) from anywhere in
the repository:

```bash
fintools/clasp-release.sh --dry-run   # preview every step
fintools/clasp-release.sh             # lib, wrapper, wrapper-tips, toolkit
fintools/clasp-release.sh wrapper     # any subset of lib|wrapper|wrapper-tips|toolkit
fintools/clasp-release.sh wrapper-tips # push only the TIPS development worksheet
```

Each project uses `clasp -A .clasp.auth` from its own directory, so the library
and the worksheet can use different Google accounts. The steps are:

1. Prechecks (skip with `--skip-checks`): no uncommitted changes under
   `fintools/`, `mktBonds/toolkit-app-script-src/` or `mktBonds/test/`,
   `sync-wrappers.mjs --check`, and `node --test mktBonds/test/*.test.mjs`.
2. `lib`: `push --force`, `version "<sha> <subject>"`, then redeploy the
   latest versioned library deployment to the new version (or create one when
   none exists; skip with `--no-deploy`).
3. `wrapper`: `push --force` only; it stays in development mode.
4. `wrapper-tips`: `push --force` only, using its own project credentials;
   it also stays in development mode.
5. `toolkit`: set the `fintools` pin in its manifest to the version just
   created (or `--pin <n>`), `push --force`, then commit only the manifest as
   "Pin toolkit to fintools library version N" (skip with `--no-commit`).
   Without `lib` or `--pin`, the current pin is pushed unchanged.

`.clasp.auth` files are git-ignored and must never be committed. The script
lives outside the clasp project directories so it is never uploaded.

### Updating other consumer sheets

Other sheets that use fintools are not touched by the release script. Update
them on demand with [update-consumer.sh](./update-consumer.sh), pointing it at
any local clasp project directory (inside or outside this repository):

The maintained [wrapper/](./wrapper/) and [wrapper-tips/](./wrapper-tips/)
projects are excluded from consumer updates; use the sync and release scripts
for them so their development-mode dependencies are preserved.

```bash
fintools/update-consumer.sh --dry-run optimizer-sheet   # show the plan
fintools/update-consumer.sh optimizer-sheet             # confirm, then apply
fintools/update-consumer.sh -V 160 --push /path/to/sheet   # pin 160 and push
fintools/update-consumer.sh --list                         # wrapper file names
```

- Only generated wrapper files from [wrapper/](./wrapper/) that already exist
  in the target are replaced, with added/removed functions listed per file.
  Use `--add <file>` to bring in another wrapper file. Sheet-specific files,
  including `onOpen.js`, are never changed.
- The `fintools` pin in the target's `appsscript.json` is set to `--version`
  or, by default, the latest library version (read with
  `lib/.clasp.auth`), and `developmentMode` is removed unless
  `--keep-dev-mode` is given.
- It warns when `lib/` or `wrapper/` changed since the commit recorded in that
  version's description, since the wrappers might then call functions the
  pinned version lacks.
- Changes require confirmation (`--yes` skips it), originals are backed up to
  a temporary directory outside the project, and nothing is pushed without
  `--push` (which uses the target's `.clasp.auth` when present).

## REFCPI caching

The migrated loader reuses fintools' existing `Cacher` and `Compress` helpers.
It prefers a document cache when available and falls back to the library's
script cache for standalone/no-document calls. Script-cache entries are shared
within that library script's cache scope, so callers can reuse or force-refresh
the same public REFCPI dataset; no worksheet-specific data is stored there.
The cache is best-effort and may be evicted early.

REFCPI now passes the calculated expiry in `Cacher`'s options object rather than
as an ignored numeric argument. It targets the existing 11 AM New York update
hour, bounded to Apps Script's permitted 1-21,600 seconds. Fresh and cached
worksheet output preserves date values and numeric columns; the maximum-date
helper still returns `YYYY-MM-DD` text.
`tipsGetMaxRefCpiDate()` returns the latest row's maximum known REFCPI date.
Pass an optional historical as-of date to return that exact row's maximum
known date. Missing historical rows, an empty dataset, and missing or invalid
maximum-date values throw errors rather than falling back to a different date.
