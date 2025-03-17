#!/usr/bin/bash
# go pull the json page off the yieldFinder app.
curl -sSL https://yieldFinder.app/json | jq .