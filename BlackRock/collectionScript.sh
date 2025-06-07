#!/usr/bin/bash
#
# Pull the driver JSON file from the BlackRock website with detailed MM fund info.
#
curl -sSL "https://www.blackrock.com/cash/en-us/product-screener/product-screener-v3.1.jsn?dcrPath=/templatedata/config/product-screener-v3/data/en/global-cash-one/cash-us/product-screener-backend-config&siteEntryPassthrough=true"
