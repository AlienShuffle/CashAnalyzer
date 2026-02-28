#!/usr/bin/bash
#
# Pull the driver JSON file from the BlackRock website with detailed MM fund info.
#
curl -sSL "https://www.blackrock.com/us/individual/product-screener/product-screener-v3.1.jsn?type=excel&siteEntryPassthrough=true&dcrPath=/templatedata/config/product-screener-v3/data/en/one/v4/product-screener-excel-config&userType=individual&disclosureContentDcrPath=/templatedata/content/article/data/en/one/DEFAULT/product-screener-all-disclaimer"