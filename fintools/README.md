# fintools Apps Script library

## Source layout

- [lib/](./lib/) is the authoritative Google Apps Script implementation,
  including the Treasury/TIPS toolkit. Existing fintools market-data APIs and
  shared helpers remain in place.
- [wrapper/](./wrapper/) contains public adapters for consuming scripts. Each
  adapter forwards to the library identifier `fintools`. Copy the required
  wrapper files into a consumer project, not into the library itself.
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

[sync-wrappers.mjs](./sync-wrappers.mjs) generates all nine legacy `fintools.*`
wrapper families and the migrated financial wrappers from library sources.
It maintains identical financial worksheet copies and the worksheet's three
Treasury adapters. Other legacy families are not copied into the toolkit.
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

Intentional corrections to previously broken or misleading behavior:

- `bankGetCurrentRateHistoryFileContents(bank, account)` requires the account;
  its old wrapper incorrectly treated argument two as a refresh boolean.
  Both raw bank-file APIs always fetch and have no refresh parameter.
- `treasuryGetCachedRecentTBillCoupons()` now uses the cache by default.
  "Coupons" remains a compatibility name for bank-discount rates.
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
the cross-account toolkit remains pinned to 156 until you select that new
published version. No manifest version is advanced automatically.

## Development and deployment

- The generic [wrapper manifest](./wrapper/appsscript.json) uses version `"0"`
  with `developmentMode: true`. It is the same-account smoke-test consumer and
  tests the library's saved HEAD.
- The [worksheet manifest](../mktBonds/toolkit-app-script-src/appsscript.json)
  pins published version `"156"` with development mode disabled (omitting
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

This repository migration does not itself upload, publish, or deploy either
Apps Script project. Local VM tests cannot certify Google Sheets authorization,
library access, or execution-time limits.

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
