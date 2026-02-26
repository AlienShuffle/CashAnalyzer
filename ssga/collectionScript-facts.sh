#!/usr/bin/bash
#
# Pull the driver JSON file from the ssga website with link and overview info about all funds.
# We will parse this for details to drive a filter fund by fund report in the node script...
#
#echo "running ssga fundlist query" 1>&2
curl -sSL "https://www.ssga.com/bin/v1/ssmp/fund/fundfinder?country=us&language=en&role=intermediary&product=&ui=fund-finder" |
    jq .
