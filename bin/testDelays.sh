#
# Must be run as a source in another shell to get the exit to work!
# source ../bin/testDelays.sh
#
#
# using the delay hours interval, and specified file, tests to see if the enough
# time has elapsed to run the script based upon either execution time, or last published update time.
#
# pubDelayHours, and runDelayHours must be set by calling script
#   - this is normally done as part of the argv processing.
#
# pubDelayFile - must be assigned in calling script to test. if empty, then no test.
# runDelayFile - must be assigned in calling script to test. if empty, then no test.
#
pubDelaySeconds=$(($pubDelayHours * 60 * 60))
#echo pubDelayFile=$pubDelayFile
#echo pubDelayHours=$pubDelayHours
#echo pubDelaySeconds=$pubDelaySeconds
if [ -s "$pubDelayFile" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$pubDelayFile")))" -lt "$pubDelaySeconds" ]; then
    if [ -z "$forceRun" ]; then
        echo "Published file is not yet $pubDelayHours hours old - $(stat -c '%y' "$pubDelayFile" | cut -d: -f1,2)"
        exit 0
    fi
fi
runDelaySeconds=$(($runDelayHours * 60 * 60))
#echo runDelayFile=$runDelayFile
#echo runDelayHours=$runDelayHours
#echo runDelaySeconds=$runDelaySeconds
if [ -s "$runDelayFile" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$runDelayFile")))" -lt "$runDelaySeconds" ]; then
    if [ -z "$forceRun" ]; then
        echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$runDelayFile" | cut -d: -f1,2)"
        exit 0
    fi
fi