#!/usr/bin/bash

usage() {
    cat <<EOF
Usage: $0 [--ignoreTaxes] [oldDir] [newDir]

If no directories are provided, uses:
  history/report-previous.txt for the old report
  history/report-latest.txt for the new report

If one directory is provided, compares that directory against the latest report.
If two directories are provided, compares oldDir against newDir.

Both directory arguments may be absolute paths, relative paths, or names under history/.
EOF
    exit 1
}

resolve_dir() {
    local dir="$1"
    if [ -d "$dir" ]; then
        printf '%s' "$dir"
        return 0
    fi
    if [ -d "history/$dir" ]; then
        printf '%s' "history/$dir"
        return 0
    fi
    return 1
}

[ "$1" = "--ignoreTaxes" ] && {
    ignoreTaxes="--ignoreTaxes"
    shift
}

if [ "$#" -gt 2 ]; then
    usage
fi

if [ ! -f history/report-latest.txt ]; then
    echo "history/report-latest.txt report file not found. Please run the report generation script first."
    exit 1
fi

latestReportDir="history/$(cat history/report-latest.txt)"
previousReportDir=""

case "$#" in
0)
    if [ ! -f history/report-previous.txt ]; then
        echo "history/report-previous.txt report file not found. Wait a day and run report generation script."
        exit 1
    fi
    previousReportDir="history/$(cat history/report-previous.txt)"
    ;;
1)
    if ! previousReportDir="$(resolve_dir "$1")"; then
        echo "Old report directory not found: $1"
        exit 1
    fi
    ;;
2)
    if ! previousReportDir="$(resolve_dir "$1")"; then
        echo "Old report directory not found: $1"
        exit 1
    fi
    if ! latestReportDir="$(resolve_dir "$2")"; then
        echo "New report directory not found: $2"
        exit 1
    fi
    ;;
esac

if [ ! -d "$previousReportDir" ]; then
    echo "$previousReportDir report directory not found, exit."
    exit 1
fi
if [ ! -d "$latestReportDir" ]; then
    echo "$latestReportDir report directory not found, exit."
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
            # choose consistent output name depending on ignoreTaxes flag
            if [ -n "$ignoreTaxes" ]; then
                echo "Ignoring taxes in comparison."
                out="$latestReportDir/b-compare-no-taxes-$(basename "$baselineReportDir").txt"
            else
                out="$latestReportDir/b-compare-$(basename "$baselineReportDir").txt"
            fi
            ./compare-runs.sh $ignoreTaxes "$baselineReportDir" "$latestReportDir" >"$out"
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
    ./compare-runs.sh $ignoreTaxes "$previousReportDir" "$latestReportDir" >b-compare-no-taxes.txt
    mv b-compare-no-taxes.txt "$latestReportDir/b-compare-no-taxes-$(basename "$previousReportDir").txt"
else
    ./compare-runs.sh "$previousReportDir" "$latestReportDir" >b-compare.txt
    mv b-compare.txt "$latestReportDir/b-compare-$(basename "$previousReportDir").txt"
fi
