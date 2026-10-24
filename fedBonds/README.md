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
retrieve a different FedInvest snapshot. To replay historical prices, first
prepare the matching FedInvest input.

Run the offline adapter and full publication integration tests from the
repository root:

```bash
node --test fedBonds/test/*.test.mjs
```
