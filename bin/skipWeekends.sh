#
# Must be run as a source in another shell to get the exit to work!
# source ../bin/skipWeekends.sh
#
# skip running on the weekends
# - Let it run into morning on Saturday to catch late updates.
# - delay until after noon on Mondays.
#
if [ -z "$forceRun" ] && [ -z "$runWeekends" ]; then
    dayOfWeek=$(date +'%a') # Sun, Mon, Tue, Wed, Thu, Fri, Sat
    hourOfDay=$(date +'%H') # 0..23
    case "$dayOfWeek" in
    Sat)
        if [ $hourOfDay -gt 9 ]; then
            echo "Weekend, don't run."
            exit 0
        fi
        ;;
    Sun)
        echo "Sunday Weekend, don't run."
        exit 0
        ;;
    Mon)
        if [ $hourOfDay -lt 12 ]; then
            echo "Monday morning, don't run."
            exit 0
        fi
        ;;
    *) ;;
    esac
fi
