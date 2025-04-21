# computer-specific configurations.
source ../meta.$(hostname).sh

grep accessionNumber "$MFPListsDir"/*.json | cut -d: -f3 | sed -e 's/\"//g' | sed -e s/,//g | sort -u > accessionList.txt
echo "##### looking at $MFPFilesDir"
find "$MFPFilesDir" -name '*.xml' -print > downloads.txt
node ./find-invalid-downloads.js accessionList.txt < downloads.txt
echo "###### looking at $MFPReportsDir"
find "$MFPReportsDir" -name '*.json' -print > rptDownloads.txt
node ./find-invalid-downloads.js accessionList.txt < rptDownloads.txt
rm -f downloads.txt accessionList.txt rptDownloads.txt