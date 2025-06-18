         echo 'yield, ticker, friendlyName, category, minimumInitialInvestment, wam, wal, expenseRatio, totalNetAssets, yieldDate, reportDate, USGO, Muni' | sed -e 's/ //g'
jq -r '.[] | [.yield,.ticker,.mmName,      .category,.minimumInitialInvestment,.wam,.wal,.expenseRatio,.totalNetAssets,.yieldDate,.reportDate,.USGO,.Muni] | @csv' "$*"
