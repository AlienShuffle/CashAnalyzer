# SSGA collection

[collectionScript-facts.sh](./collectionScript-facts.sh) retrieves the fund-finder
JSON. The shared facts job saves that JSON to a file before passing it to
[node-ssga-facts-update.js](./node-ssga-facts-update.js) on stdin.

The scraper reads the `Yields` and `Fund Characteristics` sections by heading
and matches rows by label, rather than relying on section or row positions.
Yields and coupons are decimals; duration and maturity are years. The facts
date comes from the Yields section. Missing required SEC yield/date data fails
the scrape with a nonzero exit status before any JSON output; optional missing
fields are reported on stderr.

Run parsing regression tests from the repository root:

```sh
node --test ssga/test/ssga-facts.test.mjs
```
