# BlackRock ETF collection

[job-BlackRockETF-update.sh](./job-BlackRockETF-update.sh) derives
`tickerAndUrls.csv` from the collected rates, then passes that file explicitly
to the shared facts job with `--inputFile`. Each row contains ticker, product
URL, as-of date, and SEC yield. The shared job redirects the file to the
scraper's stdin; piping rows into the shared job does not feed the scraper.

An empty facts input is an error, not a successful empty scrape. Failed
scraper runs preserve the previous facts output.

Run collector handoff and parser regression tests from the repository root:

```sh
node --test lib/test/job-file-input.test.mjs BlackRockETF/test/*.test.mjs
```
