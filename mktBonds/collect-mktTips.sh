# TIPS reference data from the Treasury fiscal data API, in TIPSmeta.csv format.
if [ -n "$1" ]; then
    cat "$1"
    exit $?
fi
node ../TIPSmeta/node-TIPSmeta-update.js
