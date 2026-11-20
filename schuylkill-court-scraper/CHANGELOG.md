# Changelog

## Unreleased

- Added `npm run match-lots` ([match-lots.js](./match-lots.js), [lib/lotmatch.js](./lib/lotmatch.js)):
  cross-references LW-plaintiff dues cases to Lake Wynonah lots by defendant address,
  owner mailing address and owner name, with ownership timing. Writes
  `output/case-lots.csv`, `lot-matches.csv` and `lot-matches.json`.
- Added `output/lot-summary.csv`: one row per lot with litigation likelihood and the
  likely number of cases, regardless of owner.

## 2026-11-20

- Rewrote the scraper: logs in with a local git-ignored `credentials.json`, searches
  Participant Name `%wynonah%` across all dates, and reads full case details
  (participants, details/disposition, dockets, judgments) instead of regex-scanning
  page text for dollar amounts.
- Added Lake Wynonah role, judgment, dues-collection and lien classification.
- Added `judgments.csv`, `dockets.csv`, `participants.csv`, dated history
  snapshots, a case ledger and change reports between runs.
- Added `--discover`, `--reanalyze`, `--max` and other CLI options, and tests.
- Adapted to the live PrimeReact portal (search dropdown, React inputs, paginator,
  participant carousels) and searches `%lwpoa%` in addition to `%wynonah%`.
- Judgments are now resolved from docket satisfaction/settlement entries, blank-party
  money judgments are attributed to LW's side, and `$0` writ rows don't count as
  open money judgments. New columns: `judgmentResolution`, `judgmentKind`,
  `resolvedBy`, `partiesInferred`, `scrapeError`, `carriedForwardFrom`.
- Added `lwEntity`; Lake Wynonah Municipal Authority (water/sewer utility) cases
  are `duesClass = no`, and the run summary shows POA-only judgment totals.
- Runs now stop with an error instead of saving incomplete results; failed case
  pages keep their previous record on full runs.
