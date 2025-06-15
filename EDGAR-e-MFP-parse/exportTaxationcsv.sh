echo 'ticker,year,months,usgo,muni,fiftyPctRule,estimateType,fiftyPctHistory,q1Pct,q2Pct,q3Pct,q4Pct,fiscalYearEnd'
jq -r '.[] | [.ticker,.year,.months,.usgo,.muni,.fiftyPctRule,.estimateType,.fiftyPctHistory,.q1Pct,.q2Pct,.q3Pct,.q4Pct,.fiscalYearEnd] | @csv' "$*"
