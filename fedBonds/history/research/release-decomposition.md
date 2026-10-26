# Matched release decomposition at a common future start

Range: 2015-01-01 through 2026-10-25; 103 complete release -5/+5 Treasury-session pairs of 105 selected pairs.

The two incomplete primary pairs retain their governing-episode exclusions; missing coverage is never filled with zero.
Common start is each post-release maxREFCPI. Securities must be quoted on the same side at both dates and mature strictly after that start.
Test buckets and 12/18/24-month training cutoffs are anchored once at pre-release settlement, with month-end-clamped calendar anniversaries. The same three nearest matched training bonds are used in every hybrid state.
Before the release, CPI is actual only through that snapshot's known maxREFCPI. The unknown extension to common start grows at the pre-release six-month SA trend as NSA log growth (ACT/365), anchored at the old horizon.
Post CPI is actual through common start. This is current-vintage replay, not a vintage-correct CPI forecast or consensus surprise. It does not use post CPI for the unknown pre-release extension.
Seasonal factors are snapshot-capped lookups/projected month-day factors; full/decay forward ratios use the same common start at both snapshots.
Financing is rederived from each snapshot's same-side T-bill quotes bracketing the common start, using the production log-discount interpolation and rate rounding. The old shorter-horizon pre-release repo rate is not extrapolated. Selected bill maturities/prices and both rates are saved.
Price = common-start transformed clean price per 100. Yield = common-start coupon-equivalent yield in bp. These differ from the previous original-settlement residual basis.
Signed residual = transformed market price/yield minus reference price/yield. Reference is a continuously compounded rate matching aggregate dirty prices of three matched longer bonds, equal par, allowing negative rates; no short test bond trains it.
Eight hybrid states switch quote (bit 1), CPI path (bit 2), and context (bit 4: settlement date, repo rate, accrued/coupon ownership roll, and seasonal ratios). Indexed coupons and their repo carry are recomputed in every state.
Shapley effects average all six update orders, splitting interactions symmetrically: residual change = quote + CPI + context - reference movement.
Reference movement is itself decomposed using all eight refits. Net quote/CPI/context subtract each reference response; their sum equals residual change. These are algebraic attributions, not independent or causal shocks.
A separate Shapley decomposition of squared residuals attributes fit improvement to quote, CPI, and context, each including reference recalibration. Positive fit contributions reduce squared residuals, and sum to pre-squared-error minus post-squared-error.
A spot-quote change includes market carry accrual and all news in the window. Net CPI is conditional on the assumed pre-release projection, not a causal inflation effect.
Training inputs retain publisher six-decimal rounding. The post hybrid corner must reproduce archived forward prices and adjustment ratios.
Equal bonds within release/side, then equal available sides within releases, then equal releases. Bootstrap intervals use 2,000 fixed-seed paired release resamples; serial/repeated-security dependence and multiple testing are not modeled.
Primary CPI state/gap is the release's announcement-to-horizon carry gap; the CPI path table separately reports projection error over the newly revealed segment.
The CPI effect and regime labels share CPI inputs: strong directional slopes are partly mechanical, not independent validation of a natural curve. Reported CPI fit contributions depend on the pre-release trend-projection assumption.
All data already informed the hypothesis. No independent prospective validation, causal CPI inference, or production switching rule is claimed.

## Primary 6–12-month full-SA price decomposition

Components are signed mean clean price per 100. Reference is minus the change in predicted common-start price. RMS residuals are episode-balanced, not realized returns.

| Cutoff | State | Episodes | Pre RMSE | Post RMSE | Quote | CPI | Roll/repo/seasonal | Reference | Residual change | Net CPI [95%] |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 12 | all | 103 | 0.28189 | 0.21382 | -0.00526 | -0.02895 | 0.03185 | 0.01488 | 0.01252 | -0.00811 [-0.03886, 0.02171] |
| 12 | below | 40 | 0.36589 | 0.24961 | 0.05293 | 0.24776 | -0.02605 | -0.11288 | 0.16176 | 0.13883 [0.10860, 0.16963] |
| 12 | near | 21 | 0.18276 | 0.19481 | -0.08967 | 0.00707 | 0.02549 | 0.03474 | -0.02236 | 0.00513 [-0.01522, 0.02380] |
| 12 | above | 42 | 0.22511 | 0.18387 | -0.01847 | -0.31049 | 0.09017 | 0.12663 | -0.11217 | -0.15468 [-0.18658, -0.12340] |
| 18 | all | 103 | 0.36096 | 0.27725 | -0.00526 | -0.02895 | 0.03185 | 0.01933 | 0.01697 | -0.01171 [-0.05054, 0.02604] |
| 18 | below | 40 | 0.45556 | 0.31716 | 0.05293 | 0.24776 | -0.02605 | -0.07802 | 0.19662 | 0.17217 [0.13545, 0.20966] |
| 18 | near | 21 | 0.24003 | 0.25010 | -0.08967 | 0.00707 | 0.02549 | 0.03536 | -0.02174 | 0.00581 [-0.02049, 0.03014] |
| 18 | above | 42 | 0.30507 | 0.24785 | -0.01847 | -0.31049 | 0.09017 | 0.10402 | -0.13477 | -0.19560 [-0.23606, -0.15625] |
| 24 | all | 103 | 0.41365 | 0.32673 | -0.00526 | -0.02895 | 0.03185 | 0.01653 | 0.01417 | -0.01627 [-0.05944, 0.02548] |
| 24 | below | 40 | 0.49398 | 0.35400 | 0.05293 | 0.24776 | -0.02605 | -0.06061 | 0.21403 | 0.18802 [0.14833, 0.22820] |
| 24 | near | 21 | 0.28621 | 0.30153 | -0.08967 | 0.00707 | 0.02549 | 0.02472 | -0.03239 | 0.00659 [-0.02266, 0.03330] |
| 24 | above | 42 | 0.38244 | 0.31143 | -0.01847 | -0.31049 | 0.09017 | 0.08591 | -0.15288 | -0.22227 [-0.26739, -0.17806] |

## Primary full-SA fit improvement: 6–12 months

All entries are squared clean price per 100. Quote/CPI/context include their reference responses and sum to total paired improvement. Intervals are exploratory episode-bootstrap intervals.

| Cutoff | State | Total improvement [95%] | Quote contribution | CPI contribution [95%] | Context contribution |
|---:|---|---|---:|---|---:|
| 12 | all | 0.03374 [0.01138, 0.06132] | 0.00703 | 0.03673 [0.01762, 0.06121] | -0.01003 |
| 12 | below | 0.07157 [0.02495, 0.13309] | 0.01891 | 0.06947 [0.02836, 0.12693] | -0.01682 |
| 12 | near | -0.00455 [-0.02428, 0.00982] | -0.00513 | -0.00126 [-0.00769, 0.00441] | 0.00184 |
| 12 | above | 0.01687 [-0.00616, 0.04015] | 0.00181 | 0.02455 [0.00480, 0.04521] | -0.00949 |
| 18 | all | 0.05342 [0.02108, 0.09231] | 0.01868 | 0.05519 [0.02606, 0.08917] | -0.02045 |
| 18 | below | 0.10694 [0.03859, 0.19021] | 0.03261 | 0.10714 [0.04629, 0.18497] | -0.03281 |
| 18 | near | -0.00494 [-0.03301, 0.01934] | 0.00181 | -0.00261 [-0.01509, 0.00768] | -0.00414 |
| 18 | above | 0.03164 [-0.00451, 0.06871] | 0.01386 | 0.03462 [0.00227, 0.06735] | -0.01684 |
| 24 | all | 0.06435 [0.02652, 0.10870] | 0.02680 | 0.06447 [0.02969, 0.10507] | -0.02692 |
| 24 | below | 0.11870 [0.04073, 0.21123] | 0.03796 | 0.12135 [0.05292, 0.20355] | -0.04062 |
| 24 | near | -0.00900 [-0.05260, 0.02889] | 0.00238 | -0.00320 [-0.01881, 0.01078] | -0.00819 |
| 24 | above | 0.04927 [0.00169, 0.09899] | 0.02837 | 0.04413 [-0.00194, 0.09094] | -0.02323 |

## Verification

```json
{
  "plannedPairs": 105,
  "completePairs": 103,
  "excludedPairs": 2,
  "dateSides": 206,
  "commonStartPaths": 103,
  "commonStartFinancingRows": 412,
  "observations": 8460,
  "hybridStates": 33840,
  "referenceCalibrations": 14832,
  "summaryRows": 792,
  "coverageRows": 1856,
  "unmatchedRows": 91,
  "influenceRows": 5346,
  "relationshipRows": 396,
  "maxPriceIdentityError": 2.220446049250313e-16,
  "maxYieldIdentityError": 6.821210263296962e-13,
  "bracketedYieldInversions": 0,
  "archivedPriceChecks": 18212,
  "maxArchivedPriceDifference": 0,
  "knownInflationViolations": 0,
  "trainingOverlapViolations": 0,
  "duplicateObservations": 0
}
```
