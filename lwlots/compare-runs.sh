#!/usr/bin/bash

[ "$1" == "" ] || [ "$2" == "" ] && {
    echo "Usage: $0 [--ignoreTaxes] <previousReportDir> <latestReportDir>"
    exit 1
}
if [ "$1" == "--ignoreTaxes" ]; then
    ignoreTaxes=true
    previousReportDir="$2"
    latestReportDir="$3"
else
    ignoreTaxes=false
    previousReportDir="$1"
    latestReportDir="$2"
fi

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
        diff "$previousReportDir/$csvBaseName" "$latestReportDir/$csvBaseName" >/dev/null
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
            case "$jsonBaseName" in
            "1-lot-list.json")
                jd \
                    <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .location + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                    <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .location + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                ;;
            "3-lot-taxes.json")
                if [ "$ignoreTaxes" = true ]; then
                    jd \
                        <(jq 'map(del(.status.historicalDelinquency) | del(.status.taxesDue) | del(.timestamp)) | map({ ((.lot | tostring) + " (" + .owners + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                        <(jq 'map(del(.status.historicalDelinquency) | del(.status.taxesDue) | del(.timestamp)) | map({ ((.lot | tostring) + " (" + .owners + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                else
                    jd \
                        <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .owners + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                        <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .owners + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                fi
                ;;
            "4-lot-normalized.json")
                jd \
                    <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .generalOwner + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                    <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .generalOwner + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                ;;
            "5-owner-list.json")
                jd \
                    <(jq 'map(del(.timestamp)) | map({ (.owner): . }) | add' "$previousReportDir/$jsonBaseName") \
                    <(jq 'map(del(.timestamp)) | map({ (.owner): . }) | add' "$latestReportDir/$jsonBaseName")
                ;;
            "6-addr-list.json")
                jd \
                    <(jq 'map(del(.timestamp)) | map({ (.address): . }) | add' "$previousReportDir/$jsonBaseName") \
                    <(jq 'map(del(.timestamp)) | map({ (.address): . }) | add' "$latestReportDir/$jsonBaseName")
                ;;

            "8-filtered-report.json")
            if [ "$ignoreTaxes" = true ]; then 
                jd \
                    <(jq 'map(del(.taxStatus.historicalDelinquency) | del(.taxStatus.taxesDue) | del(.timestamp)) | map({ ((.lot | tostring) + " (" + .generalOwner + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                    <(jq 'map(del(.taxStatus.historicalDelinquency) | del(.taxStatus.taxesDue) | del(.timestamp)) | map({ ((.lot | tostring) + " (" + .generalOwner + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                else
                    jd \
                        <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .generalOwner + ")"): . }) | add' "$previousReportDir/$jsonBaseName") \
                        <(jq 'map(del(.timestamp)) | map({ ((.lot | tostring) + " (" + .generalOwner + ")"): . }) | add' "$latestReportDir/$jsonBaseName")
                fi
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
