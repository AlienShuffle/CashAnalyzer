grep accessionNumber MFP-lists/*.json | cut -d: -f3 | sed -e 's/\"//g' | sed -e s/,//g > accessionList.txt
find MFP-files -name '*.xml' -print > downloads.txt
node ./find-invalid-downloads.js accessionList.txt < downloads.txt
find ../EDGAR-d-MFP-parse/reports -name '*.json' -print > rptDownloads.txt
node ./find-invalid-downloads.js accessionList.txt < rptDownloads.txt
rm -f downloads.txt accessionList.txt rptDownloads.txt