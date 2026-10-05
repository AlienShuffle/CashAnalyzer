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

| Step | Status |
|---|---|
| 1. Layout (originals in `appscript-src/`, ESM in `lib/`) | done |
| 2. Foundation: dates, rounding, coupons | done |
| 3. Price/yield: yield, price, duration, xirr | done |
| 4. TIPS / seasonal adjustment (`lib/tips/`: REFCPI table + factor lookups, credibility, simple/full Canty, SAO curve) | done (parity-tested; `mySaPriceFromYield` intentionally not ported) |
| 5. Returns (`lib/returns/`: `tipsNominalReturn[Table]`, `tipsPriceFromXirr`; nominal `xirr` in step 3) | done (parity-tested; `tips.intPmts`/`tipsIntPayments` skipped: unfinished drafts; replaced by the backlog item below) |
| 6. Forwards and break-even (`lib/forwards/`: `forwardRate`, `easyForward`, `forwardTipsCleanPrice`, `forwardNominalCleanPrice`, `tbillDiscountFactor`, `tbillSimpleRate`, `beiSolverSA`, `binarySolver`) | done (parity-tested; original `mybondBEISolver` wrapper not ported: it passed cleanPrice/coupon swapped) |
| 7. Zero curves (`zero.conversions`, `zero-coupon` Svensson fit) | done: `lib/zero/` (`conversions`, `svensson`: `svenssonZero`, `fitTipsSvensson`, `fitTipsSvensson` is a deterministic tau-grid + Levenberg-Marquardt fit; the Apps Script search is kept as `fitTipsSvenssonLegacy` for parity; `analyzeTipsZero` returns `{ params, objective, rows }` for curve analysis and excludes bonds matured by settlement) |
| 8. `node-calc-mktTips-curve.mjs` wiring published TIPS rows to the library | done: `job-mktTips-update.sh` publishes five change-detected Svensson curve-analysis JSON/CSV sets with dated history beside the mktTips table (`mktTips-curve`: settlement date and market clean price; `mktTips-curve-sa`: settlement curve fitted to `settle_clean_price × settle_mature_sa_ratio`; `mktTips-curve-fwd`: forward/maxREFCPI date and forward clean price; `mktTips-curve-fwd-sa`: forward curve fitted to `fwd_clean_price_unadjusted × fwd_mature_sa_ratio`; `mktTips-curve-fwd-sa-decay`: same using `fwd_mature_sa_ratio_decay`; each bond row also carries `richCheap`: `cheap`/`rich` when |`residualBp`| is at least 2, else blank; bonds maturing on or before the forward date are excluded from all); bond rows start with CUSIP for spreadsheet lookup |
| 9. Nominal zero curves for break-even inflation (`node-calc-mktBonds-curve.mjs`) | done: `job-mktTips-update.sh` publishes `mktBonds-curve` (settlement) and `mktBonds-curve-fwd` (forward/maxREFCPI date, repo-carried forward ask price) as Svensson fits with 6-month zero points (`zeroCc`, `zeroBey`, `discountFactor`) out to 30 years on the same day-count grid as the TIPS curves; candidates are non-STRIP notes, bonds and bills maturing after the forward date, priced from the ask side; bonds more than 15 bp (`--maxDeviationBp`) from the fitted curve are listed under `excluded` and refitted without; BEI is the next step |

## Backlog

- **TIPS interest paid to date** (new function; `tips.intPmts.js`/`tipsIntPayments.js` stay unported): given a TIPS, its purchase date, settlement date and the usual details (coupon, maturity, dated REFCPI, REFCPI lookup), return the total nominal coupon interest paid from purchase to settlement, net of accrued interest at purchase.

Not ported (Apps Script only): `onOpen`, `fintools.cache`, `ext.mcpher.*`, `fintools.Treasury`.
Duplicates in `appscript-src/` (`zobe.mybond.beiSolver`, `mybond.fwd.rates`) and near-duplicates
(`tips.intPmts`/`tipsIntPayments`, `mybond.calcForwardCP`/`mybond.fwd.tips.calcFwdCP`,
`discount`/`fwd.tbill.calc.discount`) will be reconciled when their layer is ported.
