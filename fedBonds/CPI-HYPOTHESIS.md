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
