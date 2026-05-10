#!/usr/bin/bash

if [ ! -f history/report-latest.txt ]; then
    echo "report-latest.txt report file not found. Please run the report generation script first."
    exit 1
fi
latestReportDir="history/$(cat history/report-latest.txt)"

[ "$1" == "--ignoreTaxes" ] && {
    ignoreTaxes="--ignoreTaxes"
    shift
}
if [ -n "$1" ]; then
    previousReportDir="history/$1"
else
    if [ ! -f history/report-previous.txt ]; then
        echo "report-previous.txt report file not found. Wait a day and run report generation script."
        exit 1
    fi
    previousReportDir="history/$(cat history/report-previous.txt)"
fi
if [ ! -d "$previousReportDir" ]; then
    echo "$previousReportDir report directory not found, exit."
    exit 1
fi

echo "comparing reports from $previousReportDir and $latestReportDir"

[ -f "$previousReportDir/1-lot-list.csv" ] || {
    echo "$previousReportDir/1-lot-list.csv: file not found. Please run the report generation script first."
    exit 1
}
[ -f "$latestReportDir/1-lot-list.csv" ] || {
    echo "$latestReportDir/1-lot-list.csv: file not found. Please run the report generation script first."
    exit 1
}

./compare-runs.sh $ignoreTaxes $previousReportDir $latestReportDir >b-compare.txt
cp b-compare.txt "$latestReportDir/b-compare-$(basename $previousReportDir).txt"
