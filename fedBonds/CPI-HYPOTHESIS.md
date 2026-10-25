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
