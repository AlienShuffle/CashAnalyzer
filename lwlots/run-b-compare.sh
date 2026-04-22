#!/usr/bin/bash
[ -f history/report-previous.txt ] || {
    echo "report-previous.txt report file not found. Wait a day and run report generation script."
    exit 1
}
[ -f history/report-latest.txt ] || {
    echo "report-latest.txt report file not found. Please run the report generation script first."
    exit 1
}

echo comparing reports from history/$(cat history/report-previous.txt) and history/$(cat history/report-latest.txt)

previousReportDir="history/$(cat history/report-previous.txt)"
latestReportDir="history/$(cat history/report-latest.txt)"

[ -f "$previousReportDir/1-lot-list.csv" ] || {
    echo "$previousReportDir/1-lot-list.csv: file not found. Please run the report generation script first."
    exit 1
}
[ -f "$latestReportDir/1-lot-list.csv" ] || {
    echo "$latestReportDir/1-lot-list.csv: file not found. Please run the report generation script first."
    exit 1
}

./compare-runs.sh history/$(cat history/report-previous.txt) history/$(cat history/report-latest.txt)