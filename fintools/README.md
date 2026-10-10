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
The existing fintools wrapper families are retained unchanged.

## Maintaining wrappers

Edit financial implementations and their public JSDoc in [lib/](./lib/), then
run from the repository root:

```sh
node fintools/sync-wrappers.mjs --write
node fintools/sync-wrappers.mjs --check
node --test mktBonds/test/*.test.mjs
```

[sync-wrappers.mjs](./sync-wrappers.mjs) generates the new canonical wrappers
and identical worksheet copies. It also maintains the worksheet's three
Treasury adapters from the existing canonical
[fintools.Treasury.js](./wrapper/fintools.Treasury.js). Do not edit generated
files directly. The generator supports the migrated APIs' simple named
parameters and literal defaults; new signatures must remain compatible or
extend the generator and its tests.

Node regression/parity tests execute the actual fintools implementations.
[fintools-integration.test.mjs](../mktBonds/test/fintools-integration.test.mjs)
checks merged-source loading, declaration collisions, wrapper coverage and
synchronization, argument/default forwarding, output identity, error
propagation, and library-to-worksheet calculation/cache boundaries.

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
