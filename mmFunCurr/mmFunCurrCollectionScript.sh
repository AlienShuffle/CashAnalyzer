#!/usr/bin/bash
#
# Pull a today's summary yields report for feeding into the processor.
#
curl -sSL "https://moneymarket.fun/data/fundYields.json" | jq .
