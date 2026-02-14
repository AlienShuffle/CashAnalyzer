#!/usr/bin/bash
# pull the json data page off the yieldFinder app.
curl -sSL https://yieldFinder.app/json | jq .