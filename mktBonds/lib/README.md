# mktBonds bond math library

For published file naming conventions and the CSV column glossary, see the
[market Treasury report reference](../README.md).

Node ESM implementation baselined against the maintained Google Apps Script
[fintools library](../../fintools/lib/). The [worksheet toolkit](../toolkit-app-script-src/)
now contains delegating wrappers; see the [fintools migration guide](../../fintools/README.md).
The [original sources](../appscript-src/)
are historical reference only; tests no longer load them.
Import from `./index.mjs`. Dates are `Date` objects or `YYYY-MM-DD` strings, rates are decimals (4% = `0.04`),
prices are per $100 par.

| Module | Exports | Ported from |
|---|---|---|
| `dates.mjs` | `normalizeDate(s)`, `daysBetween`, `daysInYearFrom`, `yearsBetween`, `dateEquals`, `dateLessThan` | `mybond._dates` |
| `rounding.mjs` | `roundTo`, `roundYield`, `roundPrice`, `roundRefCpi`, `roundCpi`, `roundSeasonal` | `mybond._utils` |
| `coupons.mjs` | `couponSchedule`, `bondFacts`, `lastCoupon`, `nextCoupon`, `accruedInterest`, `addSemiannualPeriods` | `mybond._utils`, `mybond.accrued` |
| `yield.mjs` | `yieldFromPrice` | `mybond.yieldFromPrice` |
| `price.mjs` | `priceFromYield` | `mybond.priceFromYield` |
| `duration.mjs` | `macaulayDuration`, `modifiedDuration` | `mybond.duration` |
| `xirr.mjs` | `xirr` | `mybond.xirr` |

Tests: `node --test mktBonds/test/mktBonds-lib.test.mjs`. Parity checks run the
fintools sources unmodified in a `vm` sandbox. Core math, forwards, returns,
seasonal adjustments, and Svensson fitting use that baseline while retaining
independent expected-value, round-trip, and fit-quality tests.
Run `node --test mktBonds/test/*.test.mjs` for the complete mktBonds suite.

Known behavior carried over from the original: `priceFromYield` has no bill investment-rate special case, so it is
not the exact inverse of `yieldFromPrice` for zero-coupon securities under six months.

### Return attribution

The fintools Nominal and TIPS graphs attribute purchased accrued interest as
negative `currCoupon` and `cumCoupon` at settlement. Later coupon rows report
full coupons; cumulative coupon return starts net of purchased accrued interest.
TIPS attribution uses nominal accrued interest (real accrued interest multiplied
by the settlement index ratio), rounded to six decimal places.

Node's `tipsNominalReturnTable` follows the same convention and exposes
`settlementRow` with `date`, `cashflow`, `currCoupon`, and `cumCoupon`. Its existing
`rows` array still contains only subsequent coupon/redemption rows.
Actual cash flows and XIRR are unchanged. Seasonal return components now use
the full coupon, consistent with fintools, rather than netting purchased
accrued interest against the first coupon's seasonal attribution.

### Retired solver API

The unused `beiSolverSA` and `binarySolver` exports have been removed.
Market BEI reports and nominal-minus-TIPS yield/zero-rate calculations are
unaffected. The original solver sources remain in `appscript-src/` as
historical reference, not as an active Node dependency.

### Shared Svensson fitting

The fintools `fitTipsSvensson_` in
[mybond.zero-coupon.js](../../fintools/lib/mybond.zero-coupon.js) uses
the optimizer from [svenssonFit.mjs](./zero/svenssonFit.mjs): a deterministic
12-by-12 geometric tau grid, analytic beta Jacobians, and six-parameter
Levenberg-Marquardt refinement of the best eight candidates. Both implementations
use inverse-duration weighted dirty-price errors, the same convergence settings,
tau bounds, and minimum tau separation. The result remains `{ params, objective }`.
Spreadsheet entry points and their analysis-table layout are unchanged.

Run `node --test mktBonds/test/zero-lib.test.mjs` for exact parameter/objective
parity, deterministic repeatability, forward-fixture objective below `0.72`,
synthetic-curve objective below `1e-8`, and worksheet analysis parity.
These tests execute GAS source in a local JavaScript VM; runtime under Google
Sheets' custom-function execution limit must still be checked after deployment
with realistic worksheet inputs.

## Migration status

Toolkit implementation consolidation into [fintools](../../fintools/README.md)
is complete in the repository: library implementations, canonical wrappers,
synchronized worksheet copies, and fintools-backed regression tests.
Apps Script upload, live worksheet validation, and publication/version pinning
remain deployment steps.

### Historical REFCPI availability

The default REFCPI source is this project's published
`https://cashoptimizer.pages.dev/Treasuries/REFCPI.csv`. The loader preserves the
`maxREFCPI` calendar-date mapping as `maxRefCpi` on parsed rows.

`parseRefCpiCsv`, `createRefCpiTable`, and `loadRefCpiTable` accept optional
`asOfDate`. They read the latest mapping on or before that calendar day, retain
only reference dates through its `maxREFCPI` horizon, and compute `maxDate` and
all lookups from the retained rows. Future reference dates already known on the
as-of day remain available. Without `asOfDate`, the entire table is used.
Historical analysis requires the mapping column and a date within its coverage.

Both TIPS and nominal table processors and their publication jobs accept
`--asOfDate=YYYY-MM-DD`. Their forward prices, repo rates, seasonal projections,
and downstream settlement/forward curves inherit the capped REFCPI horizon.
Supply historical quote inputs for historical price analysis: this option does
not retrieve past quotes or undo later CPI/seasonal-data revisions. Publication
jobs still write the normal output names, so run backtests with isolated output
configuration rather than overwriting current analyst datasets.

`job-mktBonds-update.sh` retains the combined `mktBonds-rate` quote feed for downstream
TIPS and curve calculations and additionally publishes `mktNominal-ask-rate` and
`mktNominal-bid-rate` JSON/CSV tables with dated history. These nominal-only tables select
the corresponding quote side, use the TIPS maxREFCPI forward date and side-specific
T-bill repo rate, and append `settle_ytm` and `forward_ytm` after settlement/forward
clean prices. Seasonal adjustments are not applicable. Forward values are null for
securities that have matured before the forward date.

The ask/bid CSV tables begin with CUSIP, `interest_rate`, security term/type,
series/description, and `maturity_date`, followed by the TIPS-only `dated_date`,
`report_source`, `asOfDate`, `settle_date`, and `fwd_date`. Nominal JSON uses
`security_type` and `maturity_date` and omits `frequency` and `key`; the combined
quote feed uses `interest_rate` and `maturity_date` and also omits `frequency` and
`key`, retaining `securitytype` and both quote sides. Both table types use `fwd_clean_price`
for the unadjusted forward clean price.

| Step | Status |
|---|---|
| 1. Layout (originals in `appscript-src/`, ESM in `lib/`) | done |
| 2. Foundation: dates, rounding, coupons | done |
| 3. Price/yield: yield, price, duration, xirr | done |
| 4. TIPS / seasonal adjustment (`lib/tips/`: REFCPI table + factor lookups, credibility, simple/full Canty, SAO curve) | done (parity-tested; `mySaPriceFromYield` intentionally not ported) |
| 5. Returns (`lib/returns/`: `tipsNominalReturn[Table]`, `tipsPriceFromXirr`; nominal `xirr` in step 3) | done (parity-tested; `tips.intPmts`/`tipsIntPayments` skipped: unfinished drafts; replaced by the backlog item below) |
| 6. Forwards (`lib/forwards/`: `forwardRate`, `easyForward`, `forwardTipsCleanPrice`, `forwardNominalCleanPrice`, `tbillDiscountFactor`, `tbillSimpleRate`) | done (parity-tested; unused legacy BEI/root solvers removed) |
| 7. Zero curves (`zero.conversions`, `zero-coupon` Svensson fit) | done: `lib/zero/` (`conversions`, `svensson`: `svenssonZero`, `fitTipsSvensson` uses a deterministic tau-grid + Levenberg-Marquardt fit, parity-tested against fintools; `analyzeTipsZero` returns `{ params, objective, rows }` for curve analysis and excludes bonds matured by settlement) |
| 8. `node-calc-mktTips-curve.mjs` wiring published TIPS rows to the library | done: `job-mktTips-update.sh` publishes parallel ask and bid TIPS datasets, each with a side-specific input table (`mktTips-ask-rate`, `mktTips-bid-rate`), five Svensson curve-analysis JSON/CSV sets, and dated history (`mktTips-curve-ask`/`mktTips-curve-bid`, `mktTips-curve-sa-*`, `mktTips-curve-fwd-*`, `mktTips-curve-fwd-sa-*`, `mktTips-curve-fwd-sa-decay-*`). Each side's curves use that side's TIPS market prices and matching nominal grid zero curve; `richCheap` is `cheap`/`rich` when |`residualBp`| is at least 2, else blank; bonds maturing on or before the forward date are excluded from all; bond rows start with CUSIP for spreadsheet lookup. Published basis labels prefix the source and side (for example, `Market-ask-settle-sa-decay`) before the settle/forward and seasonal-adjustment qualifiers. Each side-specific mktTips source table includes six calculated YTMs (settle unadjusted/SA/SA-decay, then forward unadjusted/SA/SA-decay). The Cloudflare target directory and its `daily` subdirectory contain sorted `mktTips-manifest.txt` and `mktNominal-manifest.txt` lists of matching CSV filenames; daily manifests preserve the timestamp-prefixed CSV filenames |
| 9. Nominal zero curves for break-even inflation (`node-calc-mktBonds-curve.mjs`) | done: `job-mktTips-update.sh` publishes separate `mktNominal-grid-ask`, `mktNominal-grid-fwd-ask`, `mktNominal-grid-bid` and `mktNominal-grid-fwd-bid` datasets from the corresponding quote side; each is a Svensson fit with 6-month zero points (`zeroCc`, `zeroBey`, `discountFactor`) out to 30 years; candidates are non-STRIP notes, bonds and bills maturing after the forward date; bonds more than 15 bp (`--maxDeviationBp`) from the fitted curve are listed under `excluded` and refitted without; nominal basis labels prefix source, side and settle/forward (for example, `Market-ask-forward`). TIPS curve rows carry `nominalMarketYtm` (local linear fit of the nearest 6 observed nominal yields, blank outside the observed maturity range), `marketBei` (`nominalMarketYtm - marketYtm`), `nominalModelYtm` (YTM of a nominal bond with the TIPS coupon and maturity priced off the nominal zero curve of the same date), `modelBei` (`nominalModelYtm - modelYtm`), `nominalResidualBp` (`nominalMarketYtm - nominalModelYtm` in bp), `beiResidualBp` (`nominalResidualBp - residualBp`, i.e. market minus model BEI in bp) and `zeroBei` (nominal minus TIPS semiannual zero rate at the bond's maturity). `node-calc-mktBei-grid.mjs` publishes the matching `mktBei-grid-*` datasets: TIPS and nominal zero rates and their spread on the same 6-month grid |

The TIPS pipeline also publishes the sixth curve variant, `mktTips-curve-sa-decay-ask`
and `mktTips-curve-sa-decay-bid`: settlement clean prices multiplied by
`settle_mature_sa_ratio_decay`, fitted at the settlement date. Rows without a finite
decay ratio are excluded from this adjusted curve.

Each TIPS ask/bid table appends `settle_sao`, `forward_sao`, `settle_sao_tweak`
and `forward_sao_tweak` to its JSON rows and at the right edge of its CSV. The
unsuffixed columns run `getSaoCurve` without the short-end tweak; the `_tweak`
columns hold the curve flat below its shortest fitted maturity. Settlement
columns use `settle_sa_decay_ytm` and settlement dates; forward columns use
`forward_sa_decay_ytm` and forward dates. Both variants preserve SAO's
fitted/raw yield blending, including raw yields beyond six years. The
`getSaoCurve` option `shortEndTweak` defaults to `true` for existing callers.
The toolkit spreadsheet `getSaoCurve(settles, matures, yields, shortEndTweak)`
now has the same default: points below the shortest reliable fitted maturity
use the curve value at that maturity, not an extrapolated curve value.
Its optional fourth boolean argument can be `FALSE` to retain the untweaked
curve. Worksheet output remains a single column, with blank input rows blank
and insufficient fitting data falling back to the supplied yields.

## Backlog

- **TIPS interest paid to date** (new function; `tips.intPmts.js`/`tipsIntPayments.js` stay unported): given a TIPS, its purchase date, settlement date and the usual details (coupon, maturity, dated REFCPI, REFCPI lookup), return the total nominal coupon interest paid from purchase to settlement, net of accrued interest at purchase.

Not ported (Apps Script only): `onOpen`, `fintools.cache`, `ext.mcpher.*`, `fintools.Treasury`.
Duplicates in `appscript-src/` (`zobe.mybond.beiSolver`, `mybond.fwd.rates`) and near-duplicates
(`tips.intPmts`/`tipsIntPayments`, `mybond.calcForwardCP`/`mybond.fwd.tips.calcFwdCP`,
`discount`/`fwd.tbill.calc.discount`) will be reconciled when their layer is ported.
