# Knowledge base: Schuylkill County civil portal

Findings, constraints and design rationale for the scraper. Setup and usage are
in [README.md](./README.md).

## Portal behavior

- The portal is CountySuite (Teleosoft), an ASP.NET MVC site. **Civil Case Search
  is disabled until logged in** with a paid subscription; the original script
  never logged in, which is the main reason it never worked.
- Login form: `POST /courts.civil.portal/Account/Login`, fields `AccountLogin`
  and `Password`. The home-page panel uses `id="accountLogin"` while the
  dedicated `Account/LogIn` page uses `id="AccountLogin"`, so the scraper selects
  by `name`. A bad login shows the portal's own message (e.g. "Unable to locate user").
- Page layout comes from the portal's "Civil Case Search User Guide 2023.1" (Help menu):
  - **Case Search**: `Search String` input, `Search Type` dropdown (Case Number,
    Participant Name, Participant Address, Reference Number), `Start Date` /
    `End Date` placeholders, "Judgments Only" and "Include Attorneys In Name Search"
    checkboxes, Search button.
  - **List of Cases**: Case Number, Case Participants (`Pla:`/`Def:` prefixes),
    Case Category, Contact Name, Address, Opened (date + days), Status. With
    Judgments Only: Creditor, Debtor, Judgment Amount instead of contact/address.
  - **Case Details**: header (caption, case number, case type, Open/Closed badge);
    CASE PARTICIPANTS carousels per role ("Plaintiff (1 of 2)" with ‹ › arrows);
    ADDITIONAL INFORMATION (`DATE FILED:`, `STATUS:`, `DATE CLOSED:`, `DAYS OPEN:`,
    `FINAL:`, `AOPC:`, `REFERENCE NUMBERS:`, `COMMENCEMENT:`, `NOTES:`);
    CASE DISPOSITIONS, CASE DOCKET ENTRIES and CASE JUDGMENTS tables
    (judgments: Date, Creditor, Debtor, Description, Amount; Description shows
    Satisfied/Vacated when applicable).
- Participant Name search treats `%` as a wildcard. `%wynonah%` catches every
  spelling of the association name in one search.
- **Live DOM (verified 2026-11):** after login, Civil Case Search is
  `/courts.civil.portal/CaseSearch`, a React app built on **PrimeReact**:
  - Search Type is a `p-dropdown` (`#caseSearchType`); its hidden `<select>` only
    lists "Case Number", so the scraper opens the dropdown and clicks the
    "Participant Name" overlay item, then checks the label.
  - Inputs are React-controlled (`input[name=userSearchString|startDate|endDate]`).
    Typing is used, with the native value setter plus `input` events as a fallback.
  - Checkboxes are `p-checkbox` (`#judgmentsCheckbox`, `#includeAttorneyNames`);
    the visible `.p-checkbox-box` is clicked.
  - Results are a `p-datatable` with 10 rows per page (no larger page size) and a
    `p-paginator`; Next is an icon button `.p-paginator-next` (`aria-label="show next page"`).
    Rows are per participant-contact, so a case can appear more than once.
  - Case details are at `/CaseDetails/Index/<id>`. Participant carousels keep
    **every item in the DOM** (`.participant-stacked-carousel .p-carousel-item`),
    so they are read directly without clicking arrows.
  - The dockets table has hidden checkbox/expand header columns (e.g. "toggle
    selection of all docket attachments"); column lookup prefers the shortest
    matching header. Its Category column usually repeats the description's first line.
  - `FINAL:`/`AOPC:` labels are often absent; the CASE DISPOSITIONS table rows
    (`Final - Closed`, `AOPC - A - Default Judgment`) are used instead.
- `--discover` saves each step to `debug/` for verifying or adjusting selectors.

## Scraper design

- Results rows may navigate by JavaScript instead of `href`. The scraper clicks
  such rows with request interception and answers the navigation with HTTP 204,
  which records the detail URL while keeping the results page; aborting the
  request instead replaces the tab with a Chrome error page.
- Participant carousels are read from the DOM; for other layouts the scraper falls
  back to clicking the "next" arrow until all *n* entries in "(1 of n)" are seen.
  A warning is printed if fewer are read.
- The run fails loudly instead of producing silently incomplete data when: the
  Search Type can't be set, a search shows neither results nor "No cases found",
  a clicked Next page doesn't change the table, or a detail URL isn't a case page.
- On a full run, a case whose detail page failed keeps its previous snapshot record
  (with `scrapeError` and `carriedForwardFrom`) so history isn't falsely changed.
- Session expiry (redirect to login) triggers one re-login and retry per case.
- Browser-side extraction is validated against fixture pages modeled on the
  guide screenshots (`test/fixtures/`), so `npm test` needs no portal access.

## Classification rules ([lib/analyze.js](./lib/analyze.js))

- **Lake Wynonah match**: participant/creditor/debtor names matching
  `/wynonah|\bLWPOA\b/i`.
- **Side**: participant role/side containing plaintiff, petitioner, appellant,
  creditor → Plaintiff; defendant, respondent, appellee, debtor → Defendant.
  Attorneys take the side of the column they appear in.
- **Judgment rows on the live portal**: the money judgment is often listed with
  **blank creditor and debtor** ("JUDGMENT ENTERED-NOTICES SENT" + amount). It is
  attributed to LW's side of the case (`partiesInferred`). `$0.00` rows are writs
  (execution, revival, garnishment) and are tagged `judgmentKind = Writ/other`.
- **Judgment status**: Description containing "satisfied"/"satisfaction" (not
  "unsatisfied"/"not satisfied") → Satisfied; vacated, stricken, discontinued,
  withdrawn, settled, released, opened → Released. Otherwise the latest
  case-level resolution applies to judgments dated on or before it:
  - satisfaction is usually recorded only as a **docket entry**
    ("PRAECIPE/SATISFY JUDGMENT") or a disposition → Satisfied;
  - settle/discontinue/vacate/strike docket categories, or "withdraw" naming the
    action/judgment/complaint/case → Released. Entries about a garnishee,
    attachment, writ/execution, an attorney's appearance, or a motion/petition
    only end a collection step or a filing, so they don't count. A bare
    "PRAECIPE TO WITHDRAW" (seen on still-open cases) is too ambiguous to count.

  `judgmentResolution` / `resolvedBy` show which entry was used. The case-level
  `judgmentStatus` uses money judgments when present. `judgmentOpenForLW` sums
  Open judgments where LW is creditor.
- **lwEntity**: `POA`, `Municipal Authority`, or `POA + Municipal Authority`.
  `%wynonah%` also matches **Lake Wynonah Municipal Authority** (`/municipal\s+auth/i`),
  the sewer/water utility, a separate entity from the POA. Its cases (mostly
  "Certified Commonwealth, Municipal, Suggestion Non-Payment, Lis Pendens" utility
  liens) get `duesClass = no`. They stay in the outputs; filter on `lwEntity`.
- **duesClass** (only when LW is plaintiff or a judgment creditor, and not
  Municipal Authority-only):
  `likely` when the case type suggests collection (contract, debt, collection,
  assessment, money, transcript, magisterial district, lien, judgment), dockets
  mention dues/assessments/collection, or the judgment was transferred from a
  magisterial district court; otherwise `possible`. Reasons are listed in
  `duesReasons`. HOA dues claims are commonly filed at the magisterial district
  court and the judgment transferred ("transcript") to the Prothonotary.
- **lienIndicator**: an unsatisfied money judgment in favor of LW (a Common Pleas
  judgment is a lien on the debtor's real estate in the county), an unresolved
  LW writ of revival (keeps an existing judgment lien alive), or "lien" in the
  case type or dockets. This is an indicator for review, not a legal conclusion.

## History

- Each full run writes a dated snapshot and updates the case ledger; a new
  `statusHistory` entry is added whenever case status, judgment status or final
  disposition changes. Changes are computed against the latest earlier-dated snapshot.
- Filtered/test runs do not update history because absent cases would be
  reported as missing.
