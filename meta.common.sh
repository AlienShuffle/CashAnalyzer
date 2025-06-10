# this is an include file for general parameters.
export oldestDate="12/31/2019"
# header for curl to make websites accept the request:
curlAgentHeader='User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
#
# Fund list related generated data files shared across the environment.
CIKmap="../data/CIK-map.json"
companyMap="../data/company-map.json"
finraFile="../data/finra.json"
fiscalYearFile="../data/fiscalYearFile.csv"
fundsList="../data/funds-list.txt"
fundsMetaFile="../data/fundsMeta.json"
[ -d "../data" ] || mkdir "../data"
#
# MFP source and intermediate file related folders
submissionsFilesDir="../EDGAR-b-submissions/submissions"
[ -d "$submissionsFilesDir" ] || mkdir -p "$submissionsFilesDir"

submissionsExtensionsDir="../EDGAR-b-submissions/submissions-ext"
[ -d "$submissionsExtensionsDir" ] || mkdir -p "$submissionsExtensionsDir"

MFPListsDir="../EDGAR-d-MFP-lists/MFP-lists"
[ -d "$MFPListsDir" ] || mkdir -p "$MFPListsDir"

MFPFilesDir="../EDGAR-d-MFP-lists/MFP-files"
[ -d "$MFPFilesDir" ] || mkdir -p "$MFPFilesDir"

MFPReportsDir="../EDGAR-e-MFP-parse/reports"
[ -d "$MFPReportsDir" ] || mkdir -p "$MFPReportsDir"
