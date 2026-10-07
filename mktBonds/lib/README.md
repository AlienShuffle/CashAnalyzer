# mktBonds bond math library

Node ESM port of the Google Apps Script code kept for reference in [../appscript-src/](../appscript-src).
Import from `./index.mjs`. Dates are `Date` objects or `YYYY-MM-DD` strings, rates are decimals (4% = `0.04`),
prices are per $100 par.

| Module | Exports | Ported from |
|---|---|---|
| `dates.mjs` | `normalizeDate(s)`, `daysBetween`, `daysInYearFrom`, `yearsBetween`, `dateEquals`, `dateLessThan` | `mybond.dates` |
| `rounding.mjs` | `roundTo`, `roundYield`, `roundPrice`, `roundRefCpi`, `roundCpi`, `roundSeasonal` | `mybond.utils` |
| `coupons.mjs` | `couponSchedule`, `bondFacts`, `lastCoupon`, `nextCoupon`, `accruedInterest`, `addSemiannualPeriods` | `mybond.utils` |
| `yield.mjs` | `yieldFromPrice` | `mybond.yieldFromPrice` |
| `price.mjs` | `priceFromYield` | `mybond.priceFromYield` |
| `duration.mjs` | `macaulayDuration`, `modifiedDuration` | `duration` |
| `xirr.mjs` | `xirr` | `mybond.xirr` |

Tests: `node --test mktBonds/test/mktBonds-lib.test.mjs`. They include a parity check that runs the original
Apps Script sources in a `vm` sandbox and compares results.

Known behavior carried over from the original: `priceFromYield` has no bill investment-rate special case, so it is
not the exact inverse of `yieldFromPrice` for zero-coupon securities under six months.

## Migration status

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
| 6. Forwards and break-even (`lib/forwards/`: `forwardRate`, `easyForward`, `forwardTipsCleanPrice`, `forwardNominalCleanPrice`, `tbillDiscountFactor`, `tbillSimpleRate`, `beiSolverSA`, `binarySolver`) | done (parity-tested; original `mybondBEISolver` wrapper not ported: it passed cleanPrice/coupon swapped) |
| 7. Zero curves (`zero.conversions`, `zero-coupon` Svensson fit) | done: `lib/zero/` (`conversions`, `svensson`: `svenssonZero`, `fitTipsSvensson`, `fitTipsSvensson` is a deterministic tau-grid + Levenberg-Marquardt fit; the Apps Script search is kept as `fitTipsSvenssonLegacy` for parity; `analyzeTipsZero` returns `{ params, objective, rows }` for curve analysis and excludes bonds matured by settlement) |
| 8. `node-calc-mktTips-curve.mjs` wiring published TIPS rows to the library | done: `job-mktTips-update.sh` publishes parallel ask and bid TIPS datasets, each with a side-specific input table (`mktTips-ask-rate`, `mktTips-bid-rate`), five Svensson curve-analysis JSON/CSV sets, and dated history (`mktTips-curve-ask`/`mktTips-curve-bid`, `mktTips-curve-sa-*`, `mktTips-curve-fwd-*`, `mktTips-curve-fwd-sa-*`, `mktTips-curve-fwd-sa-decay-*`). Each side's curves use that side's TIPS market prices and matching nominal curve; `richCheap` is `cheap`/`rich` when |`residualBp`| is at least 2, else blank; bonds maturing on or before the forward date are excluded from all; bond rows start with CUSIP for spreadsheet lookup. Published basis labels prefix the source and side (for example, `Market-ask-settle-sa-decay`) before the settle/forward and seasonal-adjustment qualifiers. Each side-specific mktTips source table includes six calculated YTMs (settle unadjusted/SA/SA-decay, then forward unadjusted/SA/SA-decay). The Cloudflare target directory and its `daily` subdirectory contain sorted `mktTips-manifest.txt` and `mktNominal-manifest.txt` lists of matching CSV filenames; daily manifests preserve the timestamp-prefixed CSV filenames |
| 9. Nominal zero curves for break-even inflation (`node-calc-mktBonds-curve.mjs`) | done: `job-mktTips-update.sh` publishes separate `mktNominal-curve-ask`, `mktNominal-curve-fwd-ask`, `mktNominal-curve-bid` and `mktNominal-curve-fwd-bid` datasets from the corresponding quote side; each is a Svensson fit with 6-month zero points (`zeroCc`, `zeroBey`, `discountFactor`) out to 30 years; candidates are non-STRIP notes, bonds and bills maturing after the forward date; bonds more than 15 bp (`--maxDeviationBp`) from the fitted curve are listed under `excluded` and refitted without; nominal basis labels prefix source, side and settle/forward (for example, `Market-ask-forward`). TIPS curve rows carry `nominalMarketYtm` (local linear fit of the nearest 6 observed nominal yields, blank outside the observed maturity range), `marketBei` (`nominalMarketYtm - marketYtm`), `nominalModelYtm` (YTM of a nominal bond with the TIPS coupon and maturity priced off the nominal zero curve of the same date), and `modelBei` (`nominalModelYtm - modelYtm`) |

The TIPS pipeline also publishes the sixth curve variant, `mktTips-curve-sa-decay-ask`
and `mktTips-curve-sa-decay-bid`: settlement clean prices multiplied by
`settle_mature_sa_ratio_decay`, fitted at the settlement date. Rows without a finite
decay ratio are excluded from this adjusted curve.

Each TIPS ask/bid table appends `settle_sao` to its JSON rows and at the right edge
of its CSV. This runs the unchanged `getSaoCurve` over the table's
`settle_sa_decay_ytm` yields using settlement dates and maturities. It preserves
SAO's fitted/raw yield blending, including raw yields beyond six years.

## Backlog

- **TIPS interest paid to date** (new function; `tips.intPmts.js`/`tipsIntPayments.js` stay unported): given a TIPS, its purchase date, settlement date and the usual details (coupon, maturity, dated REFCPI, REFCPI lookup), return the total nominal coupon interest paid from purchase to settlement, net of accrued interest at purchase.

Not ported (Apps Script only): `onOpen`, `fintools.cache`, `ext.mcpher.*`, `fintools.Treasury`.
Duplicates in `appscript-src/` (`zobe.mybond.beiSolver`, `mybond.fwd.rates`) and near-duplicates
(`tips.intPmts`/`tipsIntPayments`, `mybond.calcForwardCP`/`mybond.fwd.tips.calcFwdCP`,
`discount`/`fwd.tbill.calc.discount`) will be reconciled when their layer is ported.
