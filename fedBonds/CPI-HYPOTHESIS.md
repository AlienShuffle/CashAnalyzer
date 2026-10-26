# CPI carry and the short-end curve: hypothesis and experiment

## Research checkpoint: October 25, 2026

The initial study and short-end extension suggest a hypothesis, not a validated
model-switching strategy:

- Below-trend known inflation carry often favors forward/SA at the shortest
  maturities.
- Near-trend episodes often favor SA-decay, with less consistent evidence for
  settlement versus forward.
- Above-trend episodes often favor settlement/SA beyond six months.

See the [current results](./history/research/analysis.md) and the
[short-end table](./history/research/cpi-curve-short-end.csv). Pooled leader versus
runner-up intervals overlap zero in all three short-end buckets. Eligible
0–6-month observations are bid-only and frequently require extrapolation.

## Mechanism to test

Known inflation carry can displace a short bond's settlement-based yield from
the curve describing inflation risk after maxREFCPI. Below-trend carry may pull
the settlement curve away from the market's longer-end-implied short-end shape;
removing that carry may restore alignment. Above-trend carry may instead align
with that shape, making removal less helpful or causing an overshoot.

These directional effects are conjectures, not mathematical necessities.
Neither a real-yield curve nor BEI is required to slope upward. "Natural curve"
will mean an uncertain, independently estimated reference, not an imposed rising
curve. The CPI condition is known announcement-to-maxREFCPI NSA log carry minus
the prior six-month SA inflation trend, not CPI surprise versus forecasts.

## Fixed design and safeguards

- Preserve the 2015–2026 sample, exact release -5/+5 Treasury sessions, and agreed
  pandemic/rebound and shutdown exclusions. Retain later shutdown-sensitive
  observations with a separate exclusion check.
- Always require maturity strictly after historical maxREFCPI.
- Measure (0,6], (3,12], and (6,12] calendar months from original settlement.
  Calendar anniversaries are month-end-clamped. Overlapping buckets are not
  independent evidence.
- Keep all six settlement/forward and none/SA/SA-decay variants and identical
  bond universes within a date and quote side. Do not fabricate missing asks.
- Evaluate every prediction in original settlement clean prices per 100 and
  original settlement yields. Positive signed error means observed minus model.
- Positive forward improvement means settlement squared error minus forward
  squared error; negative carry-gap slope supports a larger forward advantage
  when carry is below trend.
- Average bonds within date/side, then available date/sides within episodes;
  give episodes equal weight. Missing coverage is null, never zero.
- Report signed errors, squared-error improvement, unknown-inflation days
  (maturity minus maxREFCPI), observed quote-side coverage, training support,
  and sensitivity to influential episodes.
- This is exploratory current-vintage research. All dates have already
  influenced the hypothesis: none can be called a genuinely untouched test set.
  Prospective later releases are the validation set.

## Experiment 1: longer-end-only references

Start here, emphasizing 6–12 months:

1. Fit each variant using only maturities beyond 12 calendar months from
   settlement; never use tested short bonds in training.
2. Repeat with 18- and 24-month training cutoffs. These are alternative
   longer-end references, not confidence bounds or alternative curve families.
3. Predict every eligible bond within one year. Invert the archived seasonal
   and indexed-financing transformations before comparing prices/yields.
4. Compare settlement versus forward within the same seasonal treatment,
   date, side, and held-out bonds.
5. Examine continuous carry-gap relationships, signed errors, price versus
   yield conclusions, quote sides, remaining unknown-inflation horizon, and
   removal of individual influential episodes.
6. Repeat summaries without flagged shutdown-sensitive episodes.

All short predictions deliberately extrapolate from longer bonds. Consistency
across training cutoffs strengthens robustness but does not establish an
observable "true" curve. A later alternative-family check should use a simple
independently specified reference rather than tuning to favorable short errors.

## Experiment 2: mechanical carry counterfactual design

Hold observed quotes fixed. Replace actual known CPI carry with trend-consistent
carry and recompute all affected index ratios, indexed coupon cash flows,
financing, and seasonal transformations coherently. Preserve observed prices as
observations, not as counterfactual market prices. Compare movement toward,
through, or away from longer-end references.

Changing only the forward date or one price multiplier is insufficient.
Agreement with the predicted signed displacement would support the mechanism;
disagreement would weaken it even if a regime ranking looks favorable.

## Experiment 3: matched release pairs design

Use the same bonds on both sides of the release and a common future start date
(post-release maxREFCPI). Decompose observed repricing, mechanical carry changes,
and reference-curve changes. Keep differences in bond universe and horizon from
masquerading as announcement effects. The ten-session window contains other
news, so it is not a causal CPI experiment.

## Evidence required before adopting a switching rule

The expected signed displacement should track the continuous carry gap and
unknown-inflation horizon, survive reference/side/influence checks, and remain
economically material in price units. Validate on future releases before
selecting thresholds or deploying a regime-dependent production curve.

## Experiment 1 execution and findings

Executed on October 25, 2026 using
[experiment-carry.mjs](./experiment-carry.mjs):

```bash
node fedBonds/experiment-carry.mjs --from=2015-01-01 --through=2026-10-25
```

The [reference experiment report](./history/research/carry-reference.md) and
[summary CSV](./history/research/carry-reference-summary.csv) preserve the
results. There are 208 primary dates, 7,488 reference fits, 19,332 bond
predictions, and 18,243 overlapping-bucket matched comparisons. Checks verified
that no test bond entered training, no tested maturity was on/before maxREFCPI,
and all 2,913 recorded source hashes remained unchanged.

### Primary 6–12-month pooled result

Settlement/SA has the lowest yield and price RMSE for all three training cutoffs:

| Training maturities beyond | Settlement/SA yield RMSE bp | Forward/SA yield RMSE bp | Settlement/SA price RMSE / 100 | Forward/SA price RMSE / 100 |
|---|---:|---:|---:|---:|
| 12 months | 21.55 | 57.50 | 0.1477 | 0.3072 |
| 18 months | 90.51 | 128.66 | 0.5584 | 0.8302 |
| 24 months | 155.05 | 254.21 | 0.9160 | 1.5411 |

These are descriptive rankings, not paired significance claims. Extrapolation
deteriorates substantially when the training support moves farther away.
This longer-end-only experiment is different from the earlier interleaved
maturity holdouts; it should not be expected to reproduce their rankings.

### Does the continuous carry relationship support the hypothesis?

Not robustly. For full SA at 6–12 months, the price-improvement slopes are:

| Training beyond | Slope per percentage point of carry gap | Episode-bootstrap 95% interval |
|---|---:|---|
| 12 months | +0.0084 | [-0.0104, +0.0412] |
| 18 months | -0.0099 | [-0.0979, +0.0669] |
| 24 months | +0.1083 | [-0.0071, +0.3040] |

The expected supporting direction is negative. Signs change with training
cutoff, all these price intervals include zero, and deleting one episode can
reverse the 12- and 18-month estimates. SA-decay also changes slope sign across
cutoffs. Some yield-based relationships look stronger, but are not corroborated
consistently by the price relationships. This does not validate the simple
below-trend-forward/above-trend-settlement mechanism or a switching strategy.

Two extreme extrapolated prices caused nonfinite production Newton yield
inversions. They were retained, explicitly marked, and inverted with a
bracketed solver using the identical coupon cash flows. Price scores do not
depend on that yield inversion. No production pricing behavior was changed.

### Next decision

First investigate an independently specified, better-behaved reference family
and the influential episodes, rather than treating the Svensson extrapolation
as the natural curve. The CSVs retain signed residuals and unknown-inflation
days; horizon-conditioned relationships and plots are still to be developed.
The trend-carry counterfactual and matched-bond release decomposition remain
planned, not completed. Future releases remain the genuinely prospective test.

## Independent reference and influential episodes

### Specification fixed before running

The agreed benchmark is one constant continuously compounded real rate,
calibrated separately for each date/side/variant/cutoff to the three nearest
eligible longer-maturity bonds (maturity then CUSIP order). It equates the sum
of their modeled dirty prices to observed dirty prices at equal par. It is
aggregate-price matching, not least squares. Coupons use the production
schedule and accrued-interest helpers, with ACT/365 discount times. Negative
rates are permitted. No short test prices enter calibration, and no slope is
imposed. The 12/18/24-month training cutoffs and all earlier exclusions remain
unchanged.

```bash
node fedBonds/experiment-carry.mjs --reference=flat-nearest3 --from=2015-01-01 --through=2026-10-25
```

The [independent reference report](./history/research/carry-flat.md),
[summary](./history/research/carry-flat-summary.csv), and
[influence diagnostics](./history/research/carry-flat-influence.csv) preserve
this experiment. The original Svensson files are not overwritten. Both
families use exactly the same matched short-bond comparisons. Since training
breadth also changes, this is not a controlled comparison of functional form
alone, nor an estimate of a uniquely correct "natural" curve.

Verification covered all 7,488 calibrations, 19,332 predictions, 18,243 matched
bucket comparisons, and 11,232 episode-influence rows across both families.
The three-nearest selection, aggregate-price equation, absence of short-bond
training leakage, maxREFCPI exclusion, and every reported episode-deletion slope
were checked. All 2,915 recorded input hashes matched, and the original
Svensson output files remained unchanged.

### Findings: 6–12-month primary comparison

The constant-rate benchmark is numerically much less sensitive to moving
training support farther away:

| Training beyond | Lowest pooled price-error variant | Price RMSE / 100 | Lowest pooled yield-error variant | Yield RMSE bp |
|---|---|---:|---|---:|
| 12 months | Forward/SA-decay | 0.2293 | Forward/SA-decay | 35.93 |
| 18 months | Forward/SA-decay | 0.3011 | Forward/SA-decay | 45.05 |
| 24 months | Forward/SA-decay | 0.3550 | Forward/SA-decay | 51.59 |

These descriptive winners do not establish significance or a production rule.
Below trend, forward/SA-decay leads at each cutoff; above trend, forward/SA
leads; near trend, settlement seasonal variants lead. Thus the proposed
"settlement above trend" rule does not survive changing the reference.

The continuous full-SA price-improvement slopes are all in the hypothesized
negative direction, but every primary interval still includes zero:

| Training beyond | Slope per carry-gap percentage point | Episode-bootstrap 95% interval |
|---|---:|---|
| 12 months | -0.00030 | [-0.00426, +0.00382] |
| 18 months | -0.00224 | [-0.00827, +0.00371] |
| 24 months | -0.00183 | [-0.00963, +0.00596] |

Separate quote-side slopes are also negative, but their intervals include zero.
Removing the already-flagged shutdown-sensitive episodes strengthens the
negative direction: the 18-month full-SA price interval excludes zero, whereas
the 12- and 24-month intervals do not. This is a pre-existing sensitivity check,
not grounds to select one favorable specification among many. SA-decay has
similar primary directional results and intervals crossing zero.

### Which episodes matter?

Influence tables retain every episode and identify dates, CUSIPs, unknown days,
mean/slope contributions, and leave-one-episode-out changes. No episode was
discarded or labeled a bad quote merely because it was influential.

- **Svensson, 12-month cutoff:** removing the September 12, 2019 episode flips
  the full-SA price slope from +0.00840 to -0.00384. Its most extreme paired
  observation is October 3, 2019, bid, CUSIP 912828K33 (April 15, 2020 maturity).
  The original observed clean price is 99.15625. Settlement/SA predicts
  99.14161, but forward/SA predicts 91.93983. The independent flat predictions
  are 99.31089 and 99.29781, respectively. This strongly implicates
  reference-extrapolation sensitivity in that example, not inclusion of a
  known-inflation-only TIPS or an obvious extreme source quote.
- **Svensson, 18-month cutoff:** July 2016 can reverse the slope on deletion;
  August 2016 and May 2019 are also influential. The 24-month results are
  particularly sensitive to September–November 2016, although no single
  deletion reverses the full-SA price slope there.
- **Constant-rate benchmark:** April–May 2026 and the January 9, 2015
  observation are influential across cutoffs. The latter is labeled with the
  latest-known December 17, 2014 CPI release; no quote before 2015 is used.
  Removing that episode reverses the weak 12-month slope, but no single
  episode deletion changes the negative full-SA price-slope sign at the
  18- or 24-month cutoff.

### Interpretation and remaining work

The independent reference supplies weak directional support for a larger
forward advantage below trend, not confirmation. Most importantly, model
rankings and apparent regime effects depend materially on reference
specification. Influential Svensson episodes should not be treated as direct
evidence about a stable market "natural curve."

At this checkpoint the next steps were the coherent trend-carry counterfactual
and matched-bond/common-start decomposition. Unknown-horizon conditioning,
serial-dependence-aware uncertainty, and genuinely prospective validation
remain unfinished; no regime-switching production logic has been added.

## Experiment 2 execution: settlement-anchored trend carry

The independent-reference checkpoint was saved in commit `7f492bf` before this
experiment. Executed on the same 208 eligible dates:

```bash
node fedBonds/counterfactual-carry.mjs --from=2015-01-01 --through=2026-10-25
```

### Agreed intervention and identification limits

The user selected **NSA carry equals trend, with NSA/SA seasonal factors
preserved**, anchored at each observation's settlement date, not at the CPI
announcement. Let `g` be actual settlement-to-maxREFCPI annualized ACT/365 log
NSA carry, `t` the prior-six-month SA trend from the latest-known release, and
`u` ACT/365 years from settlement. Inside the known carry window:

```text
counterfactual NSA CPI(date) = actual NSA CPI(date) * exp((t - g) * u)
counterfactual SA CPI(date)  = actual SA CPI(date)  * exp((t - g) * u)
```

This preserves the settlement CPI level, retains interior daily variation with
a smooth log tilt, and makes endpoint NSA carry equal `t`. It does **not**
impose constant daily inflation or a seasonally neutral NSA path. Identical
NSA/SA scaling leaves seasonal factors and the full/decay ratios unchanged.
No future CPI is used. Original announcement-based regime labels remain fixed;
the paths table separately discloses settlement carry gaps.

The runner holds observed settlement quotes, repo rates, financing dates,
maxREFCPI, and eligible securities fixed. It recomputes indexed coupon payments
strictly before the forward date, their financing, forward CPI, and forward
clean prices with the production pricer. Counterfactual original-settlement
predictions use the corresponding counterfactual affine price transformation,
not the actual-path slope or coupon intercept.

Two primary diagnostics hold the saved Svensson and three-bond transformed
reference curves fixed. A secondary diagnostic refits the same three longer
bonds under the counterfactual. Its training prices use the archive publisher's
six-decimal precision. No counterfactual Svensson refit was performed; the
fixed-family comparison is a mechanical sensitivity, not a claim that the
reference itself would remain fixed in a repriced market.

This experiment changes accounting carry while retaining the prices generated
under actual carry. Therefore, better fit under actual CPI can be entirely
consistent with known CPI already being priced. It cannot alone establish or
refute the causal claim that removing known carry reveals a stable natural
curve. That requires common-start matched-release evidence and prospective
validation, not treating these counterfactual predictions as market quotes.

### Primary 6–12-month findings

Full-SA forward clean-price RMSE per 100, pooled over 106 governing episodes:

| Reference treatment | Training beyond | Actual carry | Trend carry |
|---|---:|---:|---:|
| Fixed Svensson | 12 months | 0.30724 | 0.43329 |
| Fixed Svensson | 18 months | 0.83017 | 0.86686 |
| Fixed Svensson | 24 months | 1.54110 | 1.55914 |
| Fixed three-bond | 12 months | 0.23051 | 0.42101 |
| Fixed three-bond | 18 months | 0.30174 | 0.47274 |
| Fixed three-bond | 24 months | 0.35530 | 0.51349 |
| Refitted three-bond | 12 months | 0.23051 | 0.30142 |
| Refitted three-bond | 18 months | 0.30174 | 0.38967 |
| Refitted three-bond | 24 months | 0.35530 | 0.45067 |

All pooled comparisons worsen descriptively. For full-SA refitted three-bond
references, paired squared-price improvement is:

| Training beyond | Actual error squared minus counterfactual error squared | Episode-bootstrap 95% interval |
|---|---:|---|
| 12 months | -0.03772 | [-0.05680, -0.02034] |
| 18 months | -0.06080 | [-0.08898, -0.03332] |
| 24 months | -0.07686 | [-0.11280, -0.04077] |

These intervals use 2,000 paired episode resamples, not independent bonds.
They are exploratory and do not adjust for serial dependence, repeated
securities or multiple comparisons. Fixed Svensson's 24-month improvement
interval crosses zero; do not describe every worsening as statistically
resolved. SA-decay gives similar pooled deterioration with both three-bond
treatments. Original-settlement yield RMSE also worsens: refitted full-SA
12-month results increase from 36.25 to 46.86 bp.

At the 12-month cutoff, full-SA refitted three-bond results by **original
announcement-based** state are:

| State | Episodes | Actual price RMSE | Trend price RMSE | Squared-price improvement 95% interval |
|---|---:|---:|---:|---|
| Below | 43 | 0.27160 | 0.36863 | [-0.10649, -0.02845] |
| Near | 21 | 0.20347 | 0.20671 | [-0.00608, +0.00341] |
| Above | 42 | 0.19464 | 0.26231 | [-0.05351, -0.00934] |

The 18- and 24-month three-bond refits show the same qualitative state pattern:
worse below and above; little resolved change near trend. Refitting absorbs a
substantial fraction of the fixed-reference displacement, but does not
eliminate it. At the 12-month cutoff, only about 39% of episode-balanced
full-SA observations move closer in price; about 19% cross the reference.
Crossing does not necessarily mean improvement.

The signed residual shift has the expected mechanical direction: full-SA
fixed-three-bond price residuals change by roughly -0.261 per 100 below trend,
-0.005 near trend, and +0.307 above trend at the 12-month cutoff. Refitting
reduces these shifts to approximately -0.127, -0.004 and +0.152.
This confirms that the transformation matters in the predicted direction; it
does not identify a universal reference shape.

The previously weak negative full-SA three-bond carry-gap slopes do **not**
simply vanish under trend carry. They become positive at each cutoff under
both fixed and refitted references, but all primary three-bond slope intervals
still cross zero. Thus the observed regime relationship is mechanically
sensitive, not a demonstrated stable switching rule.

### Coverage, sensitivities and verification

- Ask-only, bid-only and shutdown-sensitive-excluded full-SA refitted
  three-bond pooled price improvements remain negative at all three cutoffs,
  with their episode-bootstrap intervals below zero.
- The overlapping 3–12-month and bid-only 0–6-month buckets also show worse
  pooled full-SA refitted three-bond price fit at all cutoffs. These are not
  independent confirmations. At 12 months, 0–6-month RMSE rises from 0.25877
  to 0.40859 across 100 episodes; its sparse coverage must not be generalized
  to an unavailable ask sample.
- All 18,470 eligible source rows reconstruct archived actual forward prices
  **exactly**. The 7,488 actual-path three-bond recalibrations reproduce saved
  rates exactly before counterfactual comparisons.
- Recomputed 3,034 intervening indexed-coupon lookups; retained two explicitly
  flagged bracketed yield inversions for extreme Svensson predictions.
- Saved 57,996 observations, 54,729 overlapping-bucket pairs, 2,376 summary
  rows, 1,188 relationship rows and 416 date/side CPI paths. No duplicate
  observation keys or maturity-on/before-maxREFCPI violations were found.
- Input manifests are verified before execution and again before publishing
  results. Original reference tables are not overwritten.

The [counterfactual report](./history/research/carry-counterfactual.md) and its
CSV tables preserve signed price/yield movement, uncertainty, side coverage,
training support, and both intervention and original carry-gap definitions.
The practical conclusion remains **do not deploy regime switching**.
The next step at this checkpoint was matched bonds over release -5/+5 dates,
evaluated at a common post-release start.

## Experiment 3 execution: matched releases and a common future start

Executed using [decompose-release.mjs](./decompose-release.mjs):

```bash
node fedBonds/decompose-release.mjs --from=2015-01-01 --through=2026-10-25
```

### Agreed design and accounting identity

The user approved projecting the unknown pre-release CPI segment with the
**pre-release six-month trend as NSA log growth**, and using the existing
three-nearest-bond constant-rate reference at all three cutoffs.

- Use exact -5/+5 Treasury-session dates for **103 complete pairs** from 105
  selected releases. January 2023 and January 2026 stay out because their
  pre-release snapshots are governed by excluded episodes.
- The common future start is the **post-release maxREFCPI**. It is a fixed
  pricing date within each pair, not an arbitrary shift in forward maturity.
- Intersect CUSIPs within each quote side. Require maturity strictly after
  this common start. Anchor test buckets and all 12/18/24-month cutoffs at
  the pre-release settlement, so membership and training support cannot roll.
- Calibrate the same three nearest matched longer bonds in every state by
  aggregate dirty-price matching at equal par. No short test bond enters
  training; no monotonic yield shape is imposed. This experiment does not
  add a Svensson reference family.
- Pre-release CPI is actual only through the old known horizon. Project from
  there to the common start using `exp(preTrend * ACT365 years)`. Do **not**
  read newly revealed actual CPI for this unknown segment. Post-release CPI
  is actual through the common start.
- Seasonal factors are snapshot-capped production lookups/projections.
  Full/decay ratios use the same future start in both states. The pre-release
  projection does not blend in a post-release trend or seasonal observation.
- Financing is recalculated from each snapshot's same-side T-bills bracketing
  the **common future start**, with production log-discount interpolation and
  rate rounding. The pre-release rate for its old, shorter CPI horizon is not
  extrapolated. The financing table preserves both rates and selected bills.

Compute all eight combinations of before/after quote, CPI information, and
**context** (settlement date, repo rate, accrued/coupon ownership roll, and
seasonal ratios). Recompute indexed coupons, their repo financing, and clean
prices consistently in each combination. Refit the same training bonds in
all eight combinations as well.

For signed residual `r = transformed market - reference`, averaging all six
update orders gives the exact Shapley identity:

```text
change in r = quote effect + CPI effect + context effect - reference movement
            = net quote effect + net CPI effect + net context effect
```

The net effects include the corresponding reference response. Reference
recalibration is consequently not a fourth exogenous shock; it is a response
to the same three input blocks. Components are correlated.

A second Shapley decomposition applies to **squared residuals**:

```text
pre squared error - post squared error =
    quote fit improvement + CPI fit improvement + context fit improvement
```

This distinguishes a signed displacement from movement toward the reference.
Yield nonlinearities are decomposed separately from price, not approximated
with duration.

**Important basis change:** prices and coupon-equivalent yields here are at the
**common future start**, after the chosen seasonal treatment. Earlier
experiments inverted predictions to original settlement. These result
magnitudes are not directly comparable to the previous tables.

### Primary 6–12-month findings

Full-SA common-start clean-price residual RMSE per 100:

| Training beyond pre-settlement | Before | After | Paired squared-error improvement [95% episode-bootstrap interval] |
|---|---:|---:|---|
| 12 months | 0.28189 | 0.21382 | +0.03374 [+0.01138, +0.06132] |
| 18 months | 0.36096 | 0.27725 | +0.05342 [+0.02108, +0.09231] |
| 24 months | 0.41365 | 0.32673 | +0.06435 [+0.02652, +0.10870] |

The full-SA 12-month price fit improvement decomposes as:

| Input block, including reference response | Contribution to squared-price improvement |
|---|---:|
| Quote changes | +0.00703 |
| Newly known CPI | +0.03673 |
| Settlement/repo/seasonal context | -0.01003 |
| **Total** | **+0.03374** |

The CPI fit contribution's episode-bootstrap interval is
[+0.01762, +0.06121]. It remains positive at 18 and 24 months, with intervals
above zero. This is a conditional accounting result, **not** a claim that
the CPI announcement caused this much trading profit or repricing.

By original announcement-based CPI regime, at the 12-month cutoff:

| State | Releases | Before RMSE | After RMSE | Net CPI price displacement [95% interval] |
|---|---:|---:|---:|---|
| Below | 40 | 0.36589 | 0.24961 | +0.13883 [+0.10860, +0.16963] |
| Near | 21 | 0.18276 | 0.19481 | +0.00513 [-0.01522, +0.02380] |
| Above | 42 | 0.22511 | 0.18387 | -0.15468 [-0.18658, -0.12340] |

Below trend, mean price residual moves from -0.22947 to -0.06771; above trend,
from +0.09046 to -0.02171. Thus the directional CPI correction tends to close
oppositely signed pre-release residuals in both extremes. Near trend, the CPI
piece is small while quotes and ordinary roll still move. At 12 and 18 months,
the **total** above-trend fit-improvement intervals cross zero, even though
the corresponding CPI fit contributions are positive with intervals above
zero. Do not confuse a component interval with the uncertainty in total change.

The sign pattern persists across cutoffs. Full SA and SA-decay both show
pooled improvement; at the 12-month cutoff SA-decay RMSE moves from 0.27609 to
0.21239. Unadjusted 6–12-month RMSE instead rises from 0.35752 to 0.38000;
its total improvement interval crosses zero. These are descriptive
specification comparisons, not new evidence that one adjustment dominates all
regimes.

Common-start yield results move similarly: full-SA 12-month RMSE falls from
61.80 to 43.84 bp, versus 87.07 to 56.28 below trend, 31.52 to 33.67 near
trend, and 40.63 to 33.63 above trend. Yield magnitudes are especially sensitive
to short remaining maturities.

### Quote changes, carry, and reference changes all matter

Pooled signed means can hide offsetting episodes. At the 12-month full-SA
cutoff, net price-effect RMS is 0.14429 for quotes, 0.16205 for CPI, and
0.08731 for context. These RMS effects cannot be added or interpreted as
independent variance shares.

The raw mean CPI effect is +0.24776 below trend and -0.31049 above trend.
Reference recalibration absorbs substantial movement, leaving net CPI effects
of +0.13883 and -0.15468. This supports studying **relative short/long carry
exposure**, not treating an estimated longer-end reference as fixed truth.
The same carry transformation changes long-bond calibration too.

The net CPI price-effect slope versus the original carry gap is negative at
all cutoffs (about -0.05057 per annualized gap percentage point at 12 months).
Unlike the earlier squared settlement-versus-forward performance slopes,
this is a signed mechanical displacement slope. It is **partly built into the
construction**: regime labels and the CPI intervention share actual CPI
inputs. Its narrow interval is not independent confirmation of a natural curve.

### Coverage, sensitivities, and influence

- Full-SA 6–12-month pooled RMSE improves separately on asks and bids and
  after excluding shutdown-sensitive pairs at all cutoffs. At 12 months,
  asks move from 0.23373 to 0.19373, bids from 0.28685 to 0.21590, and the
  shutdown exclusion from 0.28193 to 0.21359. The ask summary covers 97
  releases; bids cover 103. These are not identical episode samples.
- Matched 6–12-month coverage is 347 bond/side pairs across 200 release/side
  cells; matched 3–12-month coverage is 440 pairs across 200 cells.
- The matched 0–6-month sample remains **bid-only**: 123 bond pairs across
  91 releases. Full-SA 12-month RMSE falls from 0.37569 to 0.23222.
  Its smaller sample must not be generalized to nonexistent matched asks.
- January 2015 is particularly influential in pooled fit improvement.
  Removing it reduces full-SA 12-month mean improvement from +0.03374 to
  +0.02390; January 2019 is also influential. No observations were removed.
  Leave-one-release-out tables preserve the relevant dates and CUSIPs.
- Saved 8,460 price/yield decomposition rows, 33,840 hybrid market/reference
  states, and 14,832 constant-rate calibrations. Coverage and unmatched tables
  explicitly record empty buckets, missing quotes, and known-inflation-only
  securities excluded at the common start.
- All price and yield identities reconcile to numerical precision; no
  maturity-on/before-common-start bonds or training overlaps enter the scored
  sample. Original-horizon forward prices and the post common-start
  transformations reproduce archived values. All 18,212 original-horizon
  forward-price reconstruction checks have zero discrepancy; 412 pre/post
  common-start financing rows disclose their bill inputs.

### What this adds, and what it does not

This experiment is more informative about the proposed **mechanism** than an
unmatched curve-slope flip: the common start and matched bonds remove changing
horizons and universes, and the accounting separates quote movement from
newly known CPI and reference response. It gives conditional support for
carry-related displacement in the expected direction, especially outside
the near-trend band.

It does **not** establish that real yields must rise, identify an observable
natural curve, or validate settlement/forward switching. The pre-release
extension is a model assumption, not market consensus; actual quotes include
all news over the window. Seasonal data are current vintage, all dates have
already informed the hypothesis, and the bootstrap still ignores serial and
repeated-security dependence and multiple testing.

The [common-start report](./history/research/release-decomposition.md) preserves
the complete accounting. Next useful robustness checks are alternative
pre-release projection assumptions, dependence-aware uncertainty, and genuinely
prospective releases. None should be selected by whichever produces the most
favorable short-end fit.

## Endpoint conclusions: October 25, 2026

This section closes the present investigation. The possible robustness checks
above are future work, not prerequisites for stating the conclusions supported
by the completed experiments.

### Agreed summary

> Forward pricing removes an identifiable source of mechanical curve distortion
> and can improve fit in some settings. Our evidence does not establish a
> universal fit advantage, a predictable residual curve shape, or a reliable
> regime-switching rule.

The original proposed conclusion was that removing known inflation carry
marginally improves zero-coupon model-curve fit, but cannot predict or define a
default, or "natural," expected curve shape. That is a reasonable practical
summary **with a qualification on each part**:

- **Fit improvement is conditional, not universal.** Settlement/forward
  rankings vary with maturity bucket, CPI regime, seasonal adjustment,
  reference specification and training cutoff. Some advantages are modest or
  statistically unresolved. The matched-release experiment shows that updating
  CPI information improves common-start SA-adjusted fit; it does not directly
  prove that forward curves consistently fit better than settlement curves.
- **No natural shape was established.** Removing known CPI carry is a useful
  normalization, not a theory requiring an upward-sloping real zero curve.
  Neither an inverted curve nor a post-release slope reversal is, by itself,
  evidence of erroneous pricing. The experiments do not identify a unique
  expected curve against which every remaining deviation is a mispricing.
  This is a limit of the evidence obtained, not proof that forward pricing
  could never contribute to a future model of expected shape.

Forward pricing must continue to handle indexed coupons, repo financing,
seasonal adjustments and the historical CPI horizon coherently. It removes
known carry, not all economically meaningful variation. No production
settlement/forward switching rule is justified by this research.

### Expected remaining drivers

The user's interpretation is that term premiums, liquidity and
security-specific effects matter more than initially expected. That is
consistent with the residual variation and reference sensitivity, but this
study **does not separately identify or quantify those premiums**. Plausible
remaining drivers include:

- **Expected future real short rates and real term premiums:** monetary-policy
  expectations and compensation for duration/risk can produce rising, flat or
  inverted real curves even after known inflation carry is removed.
- **Liquidity and execution:** bid-ask spreads, market depth, dealer inventory
  and balance-sheet costs, and limited demand for particular remaining
  maturities can create discounts relative to a frictionless financed value.
  More liquid bills or repo can be preferable substitutes for some investors.
- **Security-specific supply, demand and financing:** issue size, issue age,
  reopening status, investor holdings, collateral value and actual repo
  availability or specialness can affect individual securities. The study's
  T-bill-implied financing proxy does not establish executable security-specific
  repo terms.
- **Cash-flow and contract differences:** coupon schedules, accrued interest,
  index ratios and, where relevant, the maturity principal deflation floor
  can affect comparisons between securities. Removing known inflation alone
  does not remove these differences.
- **Measurement and model effects:** quote side and executability, stale or
  rounded prices, settlement conventions, yield annualization, seasonal-factor
  estimation and short-end reference extrapolation can all affect apparent
  residuals. These should not automatically be called economic premiums.

For BEI, nominal-curve fitting/matching and relative nominal-versus-TIPS
liquidity also remain relevant; breakeven inflation is not a pure inflation
expectation. None of the above was isolated as the dominant explanation by
the completed experiments.

### Near-maturity observation: a separate known-cash-flow question

The user reported unusually large displayed YTM on an October 15 TIPS maturity,
even close to redemption, and suggested a liquidity discount: investors may
prefer bills or repo rather than acquire a security with only days remaining.
This is a plausible **liquidity/execution hypothesis**, not a verified
attribution from the present study.

Very short annualization can turn a small dollar discount into a large YTM.
For illustration, one cent per 100 recovered over one calendar day annualizes
to approximately 3.65% on a simple ACT/365 basis. This is a scale illustration,
not an exact TIPS coupon-equivalent yield calculation. Bid-ask costs and
settlement timing can be comparable to the apparent dollar opportunity.

When all remaining indexed cash flows are already covered by published
REFCPI, the useful question is:

> How many cents below its known remaining payment does the TIPS trade, after
> financing, settlement and transaction costs?

The user already maintains a spreadsheet comparing discount with remaining
cash flow on this basis. That is the appropriate complementary analysis.
Check executable purchase versus sale prices, final coupon/indexation,
settlement and payment dates, financing and transaction costs before assigning
the discount to liquidity or calling it an attainable return.

These fully known-inflation maturities remain outside this curve study:
securities maturing on or before the applicable maxREFCPI/common-start date
were deliberately excluded. Their near-maturity yields do not overturn the
curve-study results, and the study does not validate the anecdotal maturity's
specific pricing explanation.
