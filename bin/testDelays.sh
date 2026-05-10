#
# Must be run as a source in another shell to get the exit to work!
# source ../bin/testDelays.sh
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
# Normally, if a pubDelayFile is specified and pubDelayHours > 0, the script will run at the first run of the next day.
# If pubDelayWaitFullDays is set to true, then the script will wait until the next day to run if the pubDelayHours has not yet elapsed.
#  - This is to allow mult-day delays to be specified in hours, but still have the script run at the first run of the next day.
# 
# if nightDelayHour is set, then the script will wait until that hour to run.
# - This is to allow the script to run at a specific time of day, even if the pubDelayHours has elapsed.
# - Primary use case is scraping sites that are known to update at a specific time of day, so that the script runs shortly after the update.

# skip test if pubDelayFile does not exist.
if [ -s "$pubDelayFile" ]; then
    # skip pubDelay if set to 0
    if [ "$pubDelayHours" -ne "0" ]; then
        pubDelaySeconds=$(($pubDelayHours * 60 * 60))
        #echo pubDelayFile=$pubDelayFile
        #echo pubDelayHours=$pubDelayHours
        #echo pubDelaySeconds=$pubDelaySeconds
        #echo pubDelayWaitFullDays=$pubDelayWaitFullDays

        if [ "$pubDelayWaitFullDays" = "true" ]; then
            echo "Published file is not yet $pubDelayHours hours old - $(stat -c '%y' "$pubDelayFile" | cut -d: -f1,2)"
            exit 0
        else
            pubEpochSeconds=$(stat -c "%Y" "$pubDelayFile")
            currEpochSeconds=$(date +"%s")
            # If day of week has changed since last publish, run it!
            if [ "$(date -d @$currEpochSeconds +'%u')" -eq "$(date -d @$pubEpochSeconds +'%u')" ]; then
                # test if delay hours has passed.
                if [ -s "$pubDelayFile" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$pubDelayFile")))" -lt "$pubDelaySeconds" ]; then
                    if [ -z "$forceRun" ]; then
                        echo "Published file is not yet $pubDelayHours hours old - $(stat -c '%y' "$pubDelayFile" | cut -d: -f1,2)"
                        exit 0
                    fi
                fi
            fi
        fi
        if [ -n "$nightDelayHour" ]; then
            hour=$(date +'%H')
            #echo "Night Delay: $nightDelayHour test against $hour"
            if [ "$hour" -lt "$nightDelayHour" ]; then
                echo "Wait until $nightDelayHour:00 to run."
                exit 0
            fi
        fi
    fi
fi
runDelaySeconds=$(($runDelayHours * 60 * 60))
#echo runDelayFile=$runDelayFile
#echo runDelayHours=$runDelayHours
#echo runDelaySeconds=$runDelaySeconds
# regardless of publication delay, always wait run delay hours to space things out.
if [ -s "$runDelayFile" ] && [ "$(($(date +"%s") - $(stat -c "%Y" "$runDelayFile")))" -lt "$runDelaySeconds" ]; then
    if [ -z "$forceRun" ]; then
        echo "Last Run is not yet $runDelayHours hours old - $(stat -c '%y' "$runDelayFile" | cut -d: -f1,2)"
        exit 0
    fi
fi
