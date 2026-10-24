# FedInvest quote history

Download TreasuryDirect's FedInvest quotes for a specific report date from the
repository root:

```bash
bash FedInvest/pull-history.sh 2026-10-08
```

[pull-history.sh](./pull-history.sh) uses the existing
[collector](./collect-FedInvest.sh) and [CSV processor](../lib/node-FedInvest-update.js)
to save the same processed quote schema as the normal daily job:

- Local: `FedInvest/history/YYYY-MM-DD-rate.json` and `.csv`.
- Cloudflare publication tree:
  `~/cloudflare/public/Treasuries/FedInvest/daily/YYYY-MM-DD-rate.json` and `.csv`.

Existing snapshots for that date are replaced. Latest quote files and the
normal job's working input are not changed. No commit or push is performed.
Dates must be valid `YYYY-MM-DD` values. Empty results, malformed prices,
duplicate CUSIPs, collector errors, and mismatched report dates fail before
publishing. Each destination file is replaced atomically after validation;
the four-file publication is not a single transaction.

To subsequently generate the full FedInvest bond-report set for the saved date:

```bash
node fedBonds/report-history.mjs 2026-10-08
```

That [historical report command](../fedBonds/README.md#generate-a-historical-daily-entry)
automatically finds the local saved quote snapshot.

Run offline tests with:

```bash
node --test FedInvest/test/*.test.mjs
```
