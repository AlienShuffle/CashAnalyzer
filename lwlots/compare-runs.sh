#!/usr/bin/bash

previousReportDir="history/$1"
latestReportDir="history/$2"

[ -f "$previousReportDir/lot-list.csv" ] || {
    echo "Report file not found. Please run the report generation script first."
    exit 1
}
[ -f "$latestReportDir/lot-list.csv" ] || {
    echo "Report file not found. Please run the report generation script first."
    exit 1
}

for i in $latestReportDir/*.csv; do
    csvBaseName=$(basename "$i")
    echo -n "$csvBaseName: "
    if [ -f "$previousReportDir/$csvBaseName" ]; then
        diff "$previousReportDir/$csvBaseName" "$i"
        if [ $? -eq 0 ]; then
            echo "identical"
        else
            echo "different"
        fi
    else
        echo "File $previousReportDir/$csvBaseName not found. Skipping diff."
    fi

    jsonBaseName="${csvBaseName%.csv}.json"
    if [ -f "$latestReportDir/$jsonBaseName" ] && [ -f "$previousReportDir/$jsonBaseName" ]; then
        echo -n "$jsonBaseName: "
        # jsonDifferent.sh returns 1 for identical, 0 for different (opposite of Unix convention).
        ../bin/jsonDifferent.sh "$previousReportDir/$jsonBaseName" "$latestReportDir/$jsonBaseName"
        if [ $? -eq 0 ]; then
            echo -e "different"
        else
            echo -e "identical"
        fi
    else
        echo "JSON file $jsonBaseName not found in one of the reports. Skipping JSON comparison."
    fi
done
