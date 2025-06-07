# This script is used to drive a full pipeline when a manual ticker is
# added to the file:
# company-map-manual-entries
(
    cd EDGAR-a-CIK
    #./job-1-create-fund-list.sh -f
    #./job-2-CIK-mapping.sh -f
    echo "***** job-3-company-map.sh -f"
    ./job-3-company-map.sh -f
)
(
    cd EDGAR-b-submissions
    #echo "***** job-1-retrieve-submissions-files.sh -f"
    #./job-1-retrieve-submissions-files.sh -f
)
(
    cd EDGAR-c-meta
    echo "***** job-update-meta.sh -f"
    ./job-update-meta.sh -f
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
    echo "***** job-parse-MFP-files.sh"
    ./job-parse-MFP-files.sh
    echo "***** job-ticker-update.sh"
    ./job-ticker-update.sh
)
