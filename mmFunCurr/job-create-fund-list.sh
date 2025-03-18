#!/usr/bin/bash
#
# script pulss the list of funds being tracked across all the different queries into a single
# list of fund tickers. This is used by this query to get a full list of funds from moneymarket.fun.
# it is also used by the EDGAR tools to define a list of tickers to track EDGAR reports for too.
#
# storeHistory-funds.csv is a local list curated from the old Google App Script fund list.
# it is merged with the funds listed for yieldFinder, Vanguard, and Fidelity too.
#
find .. -name '*-funds.csv' -exec cat {} \; |
cut -d, -f1 |
sort -u > mmFunCurr-funds.txt
