find .. -name '*-funds.csv' -exec cat {} \; |
cut -d, -f1 |
sort -u > mmFunCurr-funds.txt
