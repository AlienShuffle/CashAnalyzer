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

## Experiment 2: mechanical carry counterfactual (subsequent phase)

Hold observed quotes fixed. Replace actual known CPI carry with trend-consistent
carry and recompute all affected index ratios, indexed coupon cash flows,
financing, and seasonal transformations coherently. Preserve observed prices as
observations, not as counterfactual market prices. Compare movement toward,
through, or away from longer-end references.

Changing only the forward date or one price multiplier is insufficient.
Agreement with the predicted signed displacement would support the mechanism;
disagreement would weaken it even if a regime ranking looks favorable.

## Experiment 3: matched release pairs (subsequent phase)

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
Next: matched bonds over release -5/+5 dates, evaluated at a common post-release
start, separating quote repricing, carry updates and reference recalibration.
