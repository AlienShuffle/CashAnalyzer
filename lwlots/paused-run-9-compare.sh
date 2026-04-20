#!/usr/bin/bash

[ -f report-previous.txt ] || {
    echo "report-previous.txt report file not found. Wait a day and run report generation script."
    exit 1
}
[ -f report-latest.txt ] || {
    echo "report-latest.txt report file not found. Please run the report generation script first."
    exit 1
}

previousReportDir="history/$(cat report-previous.txt)"
latestReportDir="history/$(cat report-latest.txt)"

[ -f "$previousReportDir/lot-list.csv" ] || {
    echo "Report file not found. Please run the report generation script first."
    exit 1
}
[ -f "$latestReportDir/lot-list.csv" ] || {
    echo "Report file not found. Please run the report generation script first."
    exit 1
}

./compare-runs.sh $(cat report-previous.txt) $(cat report-latest.txt)