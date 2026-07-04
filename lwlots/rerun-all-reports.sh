#!/usr/bin/bash

# update main directory reports if the 3-lot-taxes.csv file exists
if [ -f "3-lot-taxes.csv" ]; then
    ./run-4-normalize.sh
    ./run-5-create-owner-list.sh
    ./run-6-create-addr-list.sh
    ./run-7-full-report.sh
    ./run-8-filtered-report.sh
    ./run-9-stats.sh
fi
historyDirs=$(ls -d history/*/ 2>/dev/null | sort)
if [ -z "$historyDirs" ]; then
    echo "No history directories found. Please run the report generation script first."
    exit 1
fi
# loop through all the history directories and run the reports for each one using previous directory as the "old" file for comparison
previousDir=""
for dir in $historyDirs; do
    #echo "Running reports for $dir"
    rm -f $dir/b-compare-*.txt
    ./run-4-normalize.sh "$dir"
    ./run-5-create-owner-list.sh "$dir"
    ./run-6-create-addr-list.sh "$dir"
    ./run-7-full-report.sh "$dir"
    ./run-8-filtered-report.sh "$dir"
    ./run-9-stats.sh "$dir"
    if [ -n "$previousDir" ]; then
        ./run-b-compare.sh --ignoreTaxes "$previousDir" "$dir"
        ./run-b-compare.sh "$previousDir" "$dir"
    fi
    previousDir="$dir"
done
