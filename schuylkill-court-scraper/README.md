# Schuylkill County court scraper (Lake Wynonah litigation)

Collects the current and historical status of civil cases in the
[Schuylkill County Prothonotary portal](https://portal.schuylkill.pa.countysuite-azuregov.us/courts.civil.portal/)
that involve Lake Wynonah, with emphasis on judgments and liens for unpaid
association dues. Background, portal behavior and classification rules are in
[KNOWLEDGE.md](./KNOWLEDGE.md); behavior changes are in [CHANGELOG.md](./CHANGELOG.md).

## Setup

1. Install dependencies (uses the system Chrome at `/usr/bin/google-chrome-stable`
   when present; override with `PUPPETEER_EXECUTABLE_PATH`):

   ```sh
   cd schuylkill-court-scraper
   npm install
   ```

2. Create the local credentials file. It is git-ignored and must never be committed:

   ```sh
   cp credentials.example.json credentials.json
   chmod 600 credentials.json
   # edit credentials.json and enter your portal username and password
   ```

   A different file can be used with `--credentials <file>` or the
   `COURT_CREDENTIALS_FILE` environment variable.

3. Make sure the portal subscription is active before running. Without it, the
   script stops with "Civil Case Search is not available after login".

## Usage

```sh
npm run discover     # first run / after portal changes: 2 cases, saves HTML + screenshots to debug/
npm start            # full run: all "%wynonah%" and "%lwpoa%" cases, updates history
npm run reanalyze    # re-run classification on output/cases-raw.json without contacting the portal
npm test             # unit + fixture tests (no portal access)
node node-court-scraper.js --help
```

Useful options:

| Option | Purpose |
| --- | --- |
| `--max <n>` | Open only the first *n* cases (test run) |
| `--search <pattern>` | Participant Name search; repeatable. `%` is a wildcard |
| `--start/--end MM/DD/YYYY` | Limit by case opened date |
| `--judgments-only` | Use the portal's "Judgments Only" filter |
| `--save-html` | Keep each case page in `output/html/` |
| `--headful` | Show the browser (needs a display) |
| `--delay <ms>` | Pause between case pages (default 1500) |

Only a full default run (no `--max`, `--search`, `--start`, `--end`,
`--judgments-only` or `--discover`) updates `history/`; filtered runs would
otherwise make cases look "missing".

## Outputs

`output/` (current status, overwritten each run):

| File | Contents |
| --- | --- |
| `cases.csv` | One row per case; columns defined by `CASE_COLUMNS` in [lib/analyze.js](./lib/analyze.js) |
| `judgments.csv` | One row per judgment: creditor, debtor, amount, satisfied/open, LW creditor/debtor flags |
| `dockets.csv` | Every docket entry |
| `participants.csv` | Every participant with side, role, address and LW flag |
| `cases.json` | Full analyzed records |
| `cases-raw.json` | Unanalyzed scrape, input for `--reanalyze` |
| `changes.json` | Changes since the previous snapshot |

`history/` (accumulates across runs):

- `snapshots/cases-YYYY-MM-DD.json` – full analyzed data per run date
- `case-ledger.json` – per case: `firstSeen`, `lastSeen`, `statusHistory`
- `changes/changes-YYYY-MM-DD.json` – new cases, status/disposition/judgment
  changes, new dockets and cases no longer returned

Key `cases.csv` columns: `caseKind` (LW plaintiff/creditor, defendant/debtor),
`lwRole`, `opposingParties`, `judgmentTotalForLW`, `judgmentOpenForLW` (not
marked satisfied), `judgmentStatus` with `judgmentResolution` (the docket or
disposition that satisfied/released it), `duesClass` (`likely`/`possible`) with
`duesReasons` (`no` for Lake Wynonah Municipal Authority cases; see `lwEntity`), `lienIndicator` with `lienReasons`, `lastDocketDate`,
`firstSeen`, `statusHistory`, and `scrapeError` for cases whose detail page failed.
Classification rules are explained in [KNOWLEDGE.md](./KNOWLEDGE.md).

## Troubleshooting

- **Login failed: …** – the message comes from the portal; check `credentials.json`.
- **Case Search form not found / Could not set Search Type / page did not advance /
  Not a case detail page / participants not all read** – the run stops rather than
  save incomplete data;
  the portal layout may have changed. Run `npm run discover` and inspect
  `debug/*.html` and `debug/*.png`.
- `output/`, `history/`, `debug/` and `credentials.json` are git-ignored because
  they contain personal data and secrets.
