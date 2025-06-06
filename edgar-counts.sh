# count the processing status of the EDGAR data.
echo N-MFP file references in MFP-List:
grep url EDGAR-d-MFP-lists/MFP-lists/*.json | cut -d: -f2- | wc -l
echo number downloaded XML files derived from MFP-lists
find EDGAR-d-MFP-lists/MFP-files -type f -name '*.xml' -print | wc -l
echo number of parsed XML files into MM reports
find EDGAR-e-MFP-parse/reports -type f -name '*.json' -print | wc -l
echo number of parsed XML files into yield reports
find EDGAR-e-MFP-parse/yields -type f -name '*.json' -print | wc -l
echo number of tickers tracked with MM reports
find EDGAR-e-MFP-parse/tickers -type f -name '*.json' -print | wc -l
echo number of tickers tracked with yield reports
find EDGAR-e-MFP-parse/history -type f -name 'rate-new.json'  -print | wc -l