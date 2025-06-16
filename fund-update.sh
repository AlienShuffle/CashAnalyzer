# This script is used to drive a full pipeline when a manual ticker is
# added to the file:
# company-map-manual-entries
(
    cd EDGAR-a-CIK
    echo "***** job-1-create-fund-list.sh -f"
    ./job-1-create-fund-list.sh -f
    echo "***** job-2-CIK-mapping.sh -f"
    ./job-2-CIK-mapping.sh -f
    echo "***** job-3-company-map.sh -f"
    ./job-3-company-map.sh -f
)
(
    cd EDGAR-b-submissions
    echo "***** job-1-retrieve-submissions-files.sh -f"
    ./job-1-retrieve-submissions-files.sh -f
)
(
    cd EDGAR-c-meta
    echo "***** job-2-update-meta.sh -f"
    ./job-2-update-meta.sh -f
)
(
    cd EDGAR-e-MFP-parse
    echo "*****  reset-ticker-dates.sh $*"
    ./reset-ticker-dates.sh $*
)
(
    cd EDGAR-d-MFP-lists
    echo "***** job-create-MFP-lists.sh"
    ./job-create-MFP-lists.sh
    echo "***** job-download-MFP-files.sh"
    ./job-download-MFP-files.sh
)
(
    cd EDGAR-e-MFP-parse
    echo "***** job-1-parse-MFP-files.sh"
    ./job-1-parse-MFP-files.sh
    echo "***** job-2-ticker-update.sh"
    ./job-2-ticker-update.sh
    echo "***** job-3-latest-EDGAR.sh"
    ./job-3-latest-EDGAR.sh -f
     echo "***** job-4-taxation-update.sh"
    ./job-4-taxation-update.sh -f
)
