#!/usr/bin/bash

if [ ! -f history/report-latest.txt ]; then
    echo "report-latest.txt report file not found. Please run the report generation script first."
    exit 1
fi
latestReportDir="history/$(cat history/report-latest.txt)"

[ "$1" = "--ignoreTaxes" ] && {
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

[ -f "$latestReportDir/1-lot-list.csv" ] || {
    echo "$latestReportDir/1-lot-list.csv: file not found. Please run the report generation script first."
    exit 1
}

if [ -f history/report-baseline.txt ]; then
    baselineReportDir="history/$(cat history/report-baseline.txt)"
    if [ -d "$baselineReportDir" ]; then
        echo "Comparing baseline ($baselineReportDir) and $latestReportDir reports"
        if [ ! -f "$baselineReportDir/1-lot-list.csv" ]; then
            echo "$baselineReportDir/1-lot-list.csv: file not found. Please check the baseline report directory."
        else
            ./compare-runs.sh $ignoreTaxes $baselineReportDir $latestReportDir >"$latestReportDir/b-compare-$(basename $baselineReportDir).txt"
        fi
    fi
fi

echo "Comparing $previousReportDir and $latestReportDir reports"

[ -f "$previousReportDir/1-lot-list.csv" ] || {
    echo "$previousReportDir/1-lot-list.csv: file not found. Please run the report generation script first."
    exit 1
}

if [ -n "$ignoreTaxes" ]; then
    echo "Ignoring taxes in comparison."
    ./compare-runs.sh $ignoreTaxes $previousReportDir $latestReportDir >b-compare-no-taxes.txt
    cp b-compare-no-taxes.txt "$latestReportDir/b-compare-no-taxes-$(basename $previousReportDir).txt"
else
    ./compare-runs.sh $previousReportDir $latestReportDir >b-compare.txt
    cp b-compare.txt "$latestReportDir/b-compare-$(basename $previousReportDir).txt"
fi
