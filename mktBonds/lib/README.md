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
| 7. Zero curves (`zero.conversions`, `zero-coupon` Svensson fit) | done: `lib/zero/` (`conversions`, `svensson`: `svenssonZero`, `fitTipsSvensson`, `analyzeTipsZero` returns structured rows) |
| 8. `node-calc-mktBonds.mjs` wiring collector output to the library | in progress: publish job `job-mktBonds-update.sh` (collector table to cloudflare .json/.csv + daily history); calculations to be added |

## Backlog

- **TIPS interest paid to date** (new function; `tips.intPmts.js`/`tipsIntPayments.js` stay unported): given a TIPS, its purchase date, settlement date and the usual details (coupon, maturity, dated REFCPI, REFCPI lookup), return the total nominal coupon interest paid from purchase to settlement, net of accrued interest at purchase.

Not ported (Apps Script only): `onOpen`, `fintools.cache`, `ext.mcpher.*`, `fintools.Treasury`.
Duplicates in `appscript-src/` (`zobe.mybond.beiSolver`, `mybond.fwd.rates`) and near-duplicates
(`tips.intPmts`/`tipsIntPayments`, `mybond.calcForwardCP`/`mybond.fwd.tips.calcFwdCP`,
`discount`/`fwd.tbill.calc.discount`) will be reconciled when their layer is ported.
