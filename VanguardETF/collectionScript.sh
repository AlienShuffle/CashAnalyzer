#!/usr/bin/bash
# go pull the vanguard.com funds month-end reports page off the vanguard.com and return only the json portion.
curl -sSL --referer 'https://investor.vanguard.com' "https://api.vanguard.com/rs/ire/01/ind/etf/month-end.jsonp?" |
    sed -e 's/^callback(//' |
    sed -e 's/)$//' |
    jq '.fund.entity'