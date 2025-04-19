# computer-specific configurations.
source ../meta.$(hostname).sh

grep accessionNumber "$MFPListsDir"/*.json | cut -d: -f3 | sed -e 's/\"//g' | sed -e s/,//g > accessionList.txt
find "$MFPFilesDir" -name '*.xml' -print > downloads.txt
node ./find-invalid-downloads.js accessionList.txt < downloads.txt
find "$MFPListsDir" -name '*.json' -print > rptDownloads.txt
node ./find-invalid-downloads.js accessionList.txt < rptDownloads.txt
rm -f downloads.txt accessionList.txt rptDownloads.txt