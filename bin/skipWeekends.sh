#
# Must be run as a source in another shell to get the exit to work!
# source ../bin/skipWeekends.sh
#
# skip running on the weekends
# - Let it run until noon on Saturday to catch late updates.
# - delay until 8am on Mondays (market data updates around 8am NYC).
#
if [ -z "$forceRun" ] && [ -z "$runWeekends" ]; then
    dayOfWeek=$(date +'%a') # Sun, Mon, Tue, Wed, Thu, Fri, Sat
    hourOfDay=$(date +'%H') # 0..23
    case "$dayOfWeek" in
    Sat)
        if [ $((10#$hourOfDay)) -ge 12 ]; then
            echo "Weekend, don't run."
            exit 0
        fi
        ;;
    Sun)
        echo "Sunday Weekend, don't run."
        exit 0
        ;;
    Mon)
        if [ $((10#$hourOfDay)) -lt 8 ]; then
            echo "Monday morning, don't run."
            exit 0
        fi
        ;;
    *) ;;
    esac
fi
