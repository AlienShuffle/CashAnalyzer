(
    cd EDGAR-a-CIK
    ./job-1-create-fund-list.sh -f
    ./job-2-CIK-mapping.sh -f
    ./job-3-company-map.sh -f
)
(
    cd EDGAR-b-submissions
    ./job-1-retrieve-submissions-files.sh -f
)
(
    cd EDGAR-c-meta
    ./job-update-meta.sh -f
)
(
    cd EDGAR-d-MFP-lists
    ./job-create-MFP-lists.sh
    ./job-download-MFP-files.sh
)
