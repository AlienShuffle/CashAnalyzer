#!/usr/bin/bash

previousReportDir="$1"
latestReportDir="$2"

[ -f "$previousReportDir/1-lot-list.csv" ] || {
    echo "$previousReportDir/1-lot-list.csv: Report file not found. Please run the report generation script first."
    exit 1
}
[ -f "$latestReportDir/1-lot-list.csv" ] || {
    echo "$latestReportDir/1-lot-list.csv: Report file not found. Please run the report generation script first."
    exit 1
}

for i in $(basename -a $latestReportDir/*.json $latestReportDir/*.csv | cut -d'.' -f1 | sort -u); do
    csvBaseName="$i.csv"

    if [ -f "$previousReportDir/$csvBaseName" ]; then
        echo -n "$csvBaseName: "
        diff "$previousReportDir/$csvBaseName" "$latestReportDir/$csvBaseName"
        if [ $? -eq 0 ]; then
            echo "identical"
        else
            echo "different"
        fi
    fi

    jsonBaseName="$i.json"
    if [ -f "$latestReportDir/$jsonBaseName" ] && [ -f "$previousReportDir/$jsonBaseName" ]; then
        echo -n "$jsonBaseName: "
        # jsonDifferent.sh returns 1 for identical, 0 for different (opposite of Unix convention).
        ../bin/jsonDifferent.sh "$previousReportDir/$jsonBaseName" "$latestReportDir/$jsonBaseName"
        if [ $? -eq 0 ]; then
            echo -e "different"
            switch $jsonBaseName in
                "3-lot-taxes.json")
                    jd \
                      <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .owners + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                      <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .owners + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                    ;;
                *)
                    echo "No specific diff command for $jsonBaseName. Please check the files manually."
                    ;;
            esac
        else
            echo -e "identical"
        fi
    fi
done
