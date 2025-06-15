echo 'ticker,year,months,usgo,muni,fiftyPctRule,estimateType,fiftyPctHistory,qOnePct,qTwoPct,qThreePct,qFourPct'
jq -r '.[] | [.ticker,.year,.months,.usgo,.muni,.fiftyPctRule,.estimateType,.fiftyPctHistory,.qOnePct,.qTwoPct,.qThreePct,.qFourPct] | @csv' "$*"
