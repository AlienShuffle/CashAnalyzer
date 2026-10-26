# FedInvest Treasury reports

This stream runs the same nominal, TIPS, Svensson curve, seasonal-adjustment,
break-even inflation, fit-history and BEI-stability calculations as
[the market stream](../mktBonds/README.md), using FedInvest daily prices instead
of market quotes.

## Inputs and normalization

- [The FedInvest job](../FedInvest/job-FedInvest-update.sh) collects and processes
  the daily TreasuryDirect table first. This stream reads its local
  `FedInvest/history/FedInvest-rate-new.json` snapshot; it does not scrape the
  source again or use FedInvestToday.
- [The adapter](./node-fedBonds-update.mjs) maps `maturitydate` to `maturity_date`
  and preserves `rate` as a decimal coupon (for example, `0.01625` stays
  `0.01625`). Prices remain clean prices per $100, without index-ratio scaling.
  Agency `buy` becomes `ask`; agency `sell` becomes `bid`. Zero or blank prices
  mean unavailable quotes and are published as blanks, not substituted from
  the other side or `endofday`.
- Bills map to `Bill`, fixed-rate notes/bonds to `Bond`, and TIPS to `TIPS`.
  Floating-rate notes remain `FRN` in the combined quote report but are
  excluded from fixed-rate nominal yields and curve fits.
- Shared TIPS reference data comes from the locally published
  `$cloudFlareHome/Treasuries/TIPSmeta.csv`. REFCPI, seasonal factors, holidays,
  forward financing and calculation precision use the same
  code as the market stream. Missing inputs or malformed prices fail the job
  rather than falling back to market prices.
- FedInvest settles **T+0**, on the quote's `asOfDate`; market quotes retain
  **T+1**, the next bond-market trading day. The FedInvest job explicitly sets
  `--settlementDays=0` for nominal rows, TIPS rows and bill-derived financing.
  YTMs, REFCPI, seasonal adjustments, forward prices and downstream curves/grids
  all use that same settlement date.
- FedInvest's date-only `asOfDate` is retained; no intraday timestamp is invented.
  Report attribution is `FedInvest ask` / `FedInvest bid`, and curve bases use
  `FedInvest-ask-*` / `FedInvest-bid-*`.

## Outputs

The target is `$cloudFlareHome/Treasuries/fedBonds`, normally
`~/cloudflare/public/Treasuries/fedBonds`, beside `mktBonds`. Local working files
and leave-one-out caches live in `fedBonds/history`, separate from market data.

Every report family in the market stream is reproduced with the prefix
`mkt` replaced by `fed`: `fedBonds`, `fedNominal`, `fedTips`, and `fedBei`.
Columns and calculation content otherwise match the
[market report catalog](../mktBonds/README.md#published-report-families).

A complete run produces:

- **35 latest JSON and 37 latest CSV files**, including both quote sides,
  all six TIPS curve/BEI variants per side, the settlement/forward nominal
  grids, cumulative fit history and cumulative BEI stability.
- **33 daily JSON and 33 daily CSV snapshots** per report date. The combined
  quote archive is `daily/YYYY-MM-DD-rate.<ext>`; other archives are
  `daily/YYYY-MM-DD-fed<family>-<qualifiers>.<ext>`. As in the market stream,
  cumulative reports and their CSV summaries do not have daily snapshots.
- Latest and daily `fedTips-manifest.txt`, `fedNominal-manifest.txt`, and
  `fedBei-manifest.txt`, listing the matching CSV basenames.

Daily snapshots are written when report contents change. Archive statistics
only read the Fed-prefixed files in this stream's directory, including its
date-only filenames. Verdicts initially say `insufficient history` until
enough daily observations accumulate.

## Running

[job-control.sh](../job-control.sh) automatically discovers
[job-fedBonds-update.sh](./job-fedBonds-update.sh). Its alphabetical job order
runs FedInvest and TIPSmeta before this stream, and the existing Cloudflare
push job afterward. No scheduler or remote deployment configuration changes
are needed.

For a manual forced refresh, after the FedInvest and TIPSmeta inputs are ready:

```bash
cd ~/CashAnalyzer/fedBonds
./job-fedBonds-update.sh -f
```

The shared delay/weekend flags remain supported. `--asOfDate=YYYY-MM-DD`
selects the historical REFCPI horizon, as in the market stream; it does not
retrieve a different FedInvest snapshot. Use the historical command below to
select historical quotes and publish only their daily archive.

## Generate a historical daily entry

From the repository root, run:

```bash
node fedBonds/report-history.mjs 2026-10-08
```

[report-history.mjs](./report-history.mjs) first looks for processed FedInvest
JSON in these locations, in order:

1. `FedInvest/history/YYYY-MM-DD-rate.json`
2. `FedInvest/daily/YYYY-MM-DD-rate.json`
3. `$HOME/cloudflare/public/Treasuries/FedInvest/daily/YYYY-MM-DD-rate.json`
4. `FedInvest/history/FedInvest-rate-new.json`, only when all its rows match
   the requested date.

If no saved snapshot is available, it calls the existing
[FedInvest collector](../FedInvest/collect-FedInvest.sh) with the requested date
and processes the downloaded CSV. A successfully used download is saved as
`Treasuries/FedInvest/daily/YYYY-MM-DD-rate.json` for future replays.

To use a specific processed JSON file, or force a fresh TreasuryDirect query:

```bash
node fedBonds/report-history.mjs 2026-10-08 --input=/path/to/saved-quotes.json
node fedBonds/report-history.mjs 2026-10-08 --fetch
```

The explicit input must have the original processed FedInvest schema
(`asOfDate`, `securitytype`, `rate`, `maturitydate`, `buy`, `sell`, etc.),
not the adapted `fedBonds` schema. Invalid data or a mismatched date fails
explicitly; it is not silently replaced by a download.

The command runs the shared pipeline in a temporary isolated workspace, using
T+0 settlement, the historical REFCPI horizon selected by the requested date,
and the currently published TIPS metadata and seasonal-factor data. REFCPI
must include the requested date's `maxREFCPI` mapping; unavailable quotes,
missing CPI coverage or missing metadata cause failure rather than substituting
current quotes. It is a historical-price replay, not a point-in-time reconstruction
of every later metadata/seasonal-factor revision.

Only after the full calculation succeeds does it publish **33 JSON and 33 CSV
files** for that date under `Treasuries/fedBonds/daily/`, replacing entries for
the same date if present. It refreshes the three daily CSV manifests.
**Latest reports, latest manifests, normal working files, and original input
snapshots remain unchanged.** Cumulative fit-history and BEI-stability reports
are refreshed on the next normal daily job, when it reads the expanded archive.
Historical runs use a snapshot of locally published `REFCPI.csv` when available;
the network source remains the fallback when no local table exists. This allows
the extended reference table to support research beginning in 2015.
The shared job skips cumulative fits/stability inside the temporary historical
workspace, because those outputs are not published by this command. Normal daily
jobs still rebuild them as before.

No Cloudflare commit or push is performed by the historical command. An existing
scheduler may independently publish the archive. Avoid running a backfill concurrently
with the normal publisher; individual files are atomically replaced, but the
entire daily report set is not a filesystem transaction.

## Reproducible CPI-release research

The [CPI carry hypothesis and experiment design](./CPI-HYPOTHESIS.md) records the
mechanism under investigation, fixed exclusions, and staged validation plan.

The [research runner](./research-history.mjs) creates exact CPI-release **-5/+5
Treasury trading-day pairs**, never earlier than January 2015. It uses actual
monthly announcement dates, not a fixed calendar day. The release-calendar
collector removes earlier ALFRED February seasonal-revision dates when a later
monthly CPI announcement exists for the same inferred reference month.

The agreed primary release exclusions are **March 2020 through December 2022**
and **October through December 2025**. January–June 2026 remains in the primary
sample, with a flag and separate sensitivity analysis for trends affected by
filled October 2025 CPI. Data are not erased because an episode is excluded.

Prepare reference inputs with the normal metadata/CPI publication jobs. The
[metadata collector](../TIPSmeta/README.md) uses official historical auction
records, including matured TIPS. The REFCPI generator now fetches monthly inputs
starting in 2013, supplying a complete prior seasonal cycle before the first
2015 observation. Preview the plan before a potentially long backfill:

```bash
node fedBonds/research-history.mjs --from=2015-01-01 --through=2026-10-25
node fedBonds/research-history.mjs --from=2015-01-01 --through=2026-10-25 --run
node fedBonds/analyze-history.mjs --from=2015-01-01 --through=2026-10-25
```

Defaults: January 2015 through today, published inputs under
`$HOME/cloudflare/public/Treasuries`, and generated results under
`fedBonds/history/research` (ignored by Git). `--output=<dir>` changes the
result directory; `--cloud=<dir>` supports offline analysis but publication
requires the normal HOME-based destination. `--results=<file>` overrides the
execution-results file. Unknown flags and invalid dates fail.

The runner saves the complete plan and a per-date execution ledger. Successful
reports are validated as 33 JSON/CSV pairs with matching dates and row counts,
and source quotes are checked for missing historical TIPS metadata. Resuming
reuses verified dates only when reference-data and pipeline signatures match.
Missing/nonfuture CPI horizons are recorded as blocked; report failures return
a nonzero status, and analysis rejects failed or incomplete batches.

The calendar includes federal Treasury-market holidays, Juneteenth from 2022,
the December 5, 2018 closure, and Good Friday full closes versus employment-report
early closes. Early closes remain trading days. This historical calendar is for
the study; do not treat it as a continuously maintained future SIFMA schedule.
Offsets count trading sessions away from the announcement even when the release
itself occurs on a closed bond-market day, as on April 14, 2017.

[The analysis](./analyze-history.mjs) compares six settlement/forward and
unadjusted/SA/SA-decay variants on identical date/side bond universes. Three-fold
cross-validation holds out whole maturity dates. Adjusted predictions are
inverted to original settlement prices, and errors are evaluated on that common
basis. Episodes, not quote sides or bonds, are the uncertainty-resampling unit.
The neutral CPI-carry band is +/-0.50 annualized percentage point around the
prior-six-month SA inflation trend. The BEI score is conditional on the nominal
curve and local nominal-yield interpolation, not independent market BEI quotes.
It omits bonds without a matched nominal residual; observation-level bond counts
show that coverage. All-maturity errors retain very short held-out bonds even
when they require extrapolation. Separate 1–10-year scores and paired uncertainty
comparisons help distinguish supported-tenor fit from extreme short-end errors.

Short-end research also scores **0–6, 3–12, and 6–12 calendar months from
original settlement**, always excluding maturity on or before historical
maxREFCPI. Boundaries are lower-exclusive and upper-inclusive, with month-end
anniversaries clamped to the last valid day. These buckets overlap intentionally.
The fits and holdout folds still use the full eligible maturity universe.
`cpi-curve-short-end.csv` and `cpi-curve-short-observations.csv` disclose sparse
coverage, nominal matches, remaining days beyond maxREFCPI, extrapolated
holdouts, original clean-price errors per 100, and yield errors in bp.
Ask/bid date counts and separate side scores expose one-sided coverage; in the
2015–2026 sample the eligible 0–6-month observations are bid-only.
Empty buckets are missing, never zero. Episode-weighted short-end rankings and
paired bootstrap intervals are included in `analysis.md` and the JSON results.
The CV cache retains bond-level errors and invalidates older aggregate-only
entries when the short-end methodology changes.

After producing that study, run the first hypothesis experiment:

```bash
node fedBonds/experiment-carry.mjs --from=2015-01-01 --through=2026-10-25
```

It rejects a changed study/sample or changed archived inputs. Each of the six
variants is refitted using only maturities beyond 12, 18, and 24 calendar months;
eligible sub-one-year bonds are exclusively test observations. All predictions
are converted back to original settlement prices/yields. This is a
longer-end-only reference experiment, not a short-end curve fit.
`carry-reference.md` and the associated observation, summary, paired-improvement,
and continuous-relationship CSVs include signed residuals, unknown-inflation
days, quote-side/shutdown checks, and episode-bootstrap slope intervals.
Positive squared-error improvement favors forward. A negative slope versus the
carry-minus-trend gap supports the hypothesized below-trend forward advantage.
All references are Svensson extrapolations; cutoff sensitivity is not a
different model-family check. The first run performs thousands of fits; later
runs reuse source/engine-fingerprinted parameters. The common-start matched
release decomposition is documented below.

To run the independently specified reference and influential-episode comparison:

```bash
node fedBonds/experiment-carry.mjs --reference=flat-nearest3 --from=2015-01-01 --through=2026-10-25
```

This benchmark uses only the three nearest training bonds beyond each cutoff,
ordered by maturity then CUSIP. It calibrates a single continuously compounded
ACT/365 rate by matching their aggregate dirty price at equal par. This is not
least squares, and the resulting rate may be negative. It imposes no rising
yield shape. All short test bonds remain excluded from calibration.

`carry-flat.md` and the `carry-flat-*.csv` tables preserve the original Svensson
outputs and compare continuous carry relationships against that baseline.
The command requires the previous Svensson result tables and validates their
input hashes and exact matched-bond coverage. The influence table identifies
each episode's mean/slope contribution, leave-one-episode-out change, quote
dates, securities, and largest raw bond-level improvement. Episodes are ranked,
not deleted; the primary results keep all eligible episodes.
Results can differ because both the family and training breadth change. This
benchmark is not the observable "natural curve," a production recommendation,
or an independent prospective test. An episode label in late 2014 can govern an
early-2015 observation; the quote sample still starts in 2015.

After both references are saved, run the mechanical trend-carry test:

```bash
node fedBonds/counterfactual-carry.mjs --from=2015-01-01 --through=2026-10-25
```

The [counterfactual runner](./counterfactual-carry.mjs) validates the study,
release plan, execution ledger, both reference manifests, and all source hashes.
It anchors CPI at each observation's settlement and smoothly tilts the known
daily NSA path so settlement-to-maxREFCPI annualized log carry equals the
latest-known release's prior-six-month SA trend. Applying the identical tilt
to SA CPI preserves seasonal factors and full/decay adjustment ratios.
Observed prices, dates, repo rates and bond selection do not change.
Intervening indexed coupons and forward prices are recomputed coherently.

`carry-counterfactual.md` and its observation, summary, paths, pair and
relationship CSVs distinguish **fixed Svensson**, **fixed three-bond**, and
**refitted three-bond** references. The fixed cases isolate the transformation;
the refit shows how much longer-end recalibration absorbs. There is no new
Svensson refit. The runner proves actual-path forward-price reconstruction and
three-bond calibration identity before evaluating the counterfactual.
Training prices retain the archive publisher's six-decimal rounding.
The input-hash and verification JSONs make the run auditable.

Positive counterfactual improvement means actual squared error minus
trend-path squared error, with paired episode-bootstrap intervals for prices.
The separate settlement-versus-forward relationship tables keep the earlier
sign convention and **original announcement-based** carry-gap labels, even
though the intervention is settlement-anchored. Signed residual movements,
fractions moving toward/through the reference, sparse bid-only 0–6-month
coverage, and shutdown/quote-side sensitivities are disclosed.
This is a mechanical sensitivity at fixed observed prices, **not** simulated
market repricing, a causal experiment, or a recommendation to replace known CPI.

To separate actual matched-quote changes from CPI/financing updates around
each release, run:

```bash
node fedBonds/decompose-release.mjs --from=2015-01-01 --through=2026-10-25
```

The [release runner](./decompose-release.mjs) uses exact -5/+5 Treasury-session
pairs with both primary snapshots eligible. The common future start is the
post-release maxREFCPI. It intersects CUSIPs **within each quote side** and
requires maturity strictly after that common date. Test buckets and training
cutoffs are anchored once at the **pre-release settlement**; test/training
membership cannot change within a pair. At every 12/18/24-month cutoff, the same
three nearest matched longer bonds calibrate a constant-rate reference.
Missing asks are not synthesized.

Before-release CPI is known only through that snapshot's old maxREFCPI. The
unknown segment to the common start is projected with the **pre-release**
six-month SA trend as annualized NSA log growth. This assumed extension is
anchored at the old horizon, unlike the settlement-anchored trend intervention
above. After-release CPI is actual through the common start. Seasonal-factor
lookups are capped at each snapshot's horizon; full/decay ratios use the same
future start and production credibility rules.
Financing is rederived from each snapshot's same-side T-bills bracketing the
**common** start, using production discount interpolation and rounding, rather
than extending the old shorter-horizon pre-release repo rate.

The runner calculates all eight combinations of before/after:

1. Observed clean quotes.
2. CPI information/path.
3. Settlement date, repo rate and seasonal ratios (the **context** block).

Each combination recomputes indexed coupon ownership and repo carry. Shapley
attribution averages all six update orders to split interactions symmetrically:
**residual change = quote + CPI + context - reference movement**.
Refitting the same training bonds at all eight combinations also produces
**net quote/CPI/context** contributions, which include each reference response
and sum to residual change. A separate squared-residual decomposition attributes
fit improvement; positive fit contributions reduce squared errors. Neither
these algebraic pieces nor their uncertainty estimates are independent shocks.

Unlike previous experiment scores, all prices and coupon-equivalent yields
here are evaluated **at the common future start**, not original settlement.
Common-start transformed clean-price errors are per 100; yields are bp.
Signed residuals are market minus reference. Results must not be numerically
compared with the earlier settlement-basis errors as if they were identical.

`release-decomposition.md` and the `release-decomposition-*.csv` tables save:

- Bond-level price/yield decompositions and every hybrid market/reference state.
- All reference calibrations, selected CUSIPs, training prices and support.
- Common-start repo rates and their bracketing bill maturities/prices, with
  original-horizon rates preserved for comparison and reconstruction checks.
- Matched coverage, empty side/buckets, omitted securities and their reasons.
- Assumed pre-release CPI extensions and actual endpoints.
- Episode-balanced signed/RMS effects, fit-improvement contributions and
  2,000-resample paired release-bootstrap intervals.
- Quote-side/shutdown sensitivities, descriptive carry-gap slopes, and
  leave-one-release-out influence.

The JSON hash manifest and verification report check source integrity,
original-horizon archive reconstruction, no short-bond training leakage, and
exact price/yield decomposition identities. These checks run before results
are published. This is current-vintage historical replay; CPI effects depend
on the assumed pre-release projection, and CPI-regime labels share their
inputs. The ten-session window includes other news. A strong signed CPI
relationship is therefore **not causal or independent validation** of a
natural curve, a forecast, or a production switching rule.

Outputs include `analysis.md`, full JSON results, per-observation and summary
CSVs, exact-date pre/post comparisons, source SHA-256 hashes, and a reusable
cross-validation cache. These measure cross-sectional yield/price fit and curve
shape, **not realized returns, causal CPI effects, or a point-in-time strategy**.
Pre-release snapshots use only their latest already-available release label;
those governed by excluded episodes are omitted from primary regime scores.
Use identical `--from`, `--through`, and `--output` options for generation and
analysis.

The [October 25 pilot report](./research-baseline/analysis-2026-10-25.md) and its
tables are preserved as a baseline, including its documented incomplete
historical metadata. They are not updated by the new study.

### Incorporating backfills into fit and stability analysis

Historical dates enter the published cumulative analyses on the **next normal
FedInvest report-job run**, not immediately when the backfill finishes.
The backfill calculates fits in its isolated workspace but publishes only the
requested date's daily reports and updates the daily manifests.

[job-fedBonds-update.sh](./job-fedBonds-update.sh) invokes the shared
[TIPS publication job](../mktBonds/job-mktTips-update.sh), which rescans the full
`Treasuries/fedBonds/daily/` archive with `--prefix=fed`:

- **Fit history:** [loadArchivedCurves](../mktBonds/node-calc-mktTips-fitHistory.mjs)
  reads the archived Fed TIPS curves, including date-only filenames, and groups
  them by report date, quote side, and settlement/forward valuation. It rebuilds
  fit statistics for unadjusted, SA, and SA-decay curves, plus the SA-versus-SA-decay
  summaries, using all available observations.
- **BEI stability:** [loadSnapshots](../mktBonds/node-calc-mktBei-stability.mjs)
  includes dates with the complete supporting TIPS rows, nominal curves, and
  SA/SA-decay TIPS curves. Added dates enter the chronological stability
  comparisons; missing leave-one-out sensitivity results are calculated and
  cached. Cache entries are invalidated when a same-date curve, its forward
  date, or the short-maturity cutoff changes, so repaired historical metadata
  cannot leave stale sensitivity results. Incomplete snapshots are skipped.

The job republishes `fedTips-fitHistory-rate.json` / `.csv` and
`fedBei-stability-rate.json` / `.csv`, along with their
`fedTips-fitHistory-summary-rate.csv` and `fedBei-stability-summary-rate.csv`
summaries. Historical observations contribute toward the default **10-day
minimum** for history-dependent verdicts. FedInvest and market observations
remain separate.

To refresh the cumulative analyses immediately after completing one or more
backfills:

```bash
cd ~/CashAnalyzer/fedBonds
./job-fedBonds-update.sh -f --runWeekends
```

This runs the normal reporting flow, including current reports, rather than an
analysis-only refresh. Downloading historical quotes with
[pull-history.sh](../FedInvest/pull-history.sh) alone does **not** create a fit
observation: also run [report-history.mjs](./report-history.mjs) for that date to
generate the fitted curves and supporting daily reports.

Run the offline adapter and full publication integration tests from the
repository root:

```bash
node --test fedBonds/test/*.test.mjs
```
