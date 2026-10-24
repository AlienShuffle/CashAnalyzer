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
No Cloudflare commit or push is performed. Avoid running a backfill concurrently
with the normal publisher; individual files are atomically replaced, but the
entire daily report set is not a filesystem transaction.

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
  cached. Incomplete snapshots are skipped.

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
