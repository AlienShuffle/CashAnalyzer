# this must be run as a source in another shell to get the exit to work!
# skip running on the weekends, I may logic to avoid Monday mornings too!
dayOfWeek=$(date +'%a')
case "$dayOfWeek" in
Sat | Sun)
    if [ -z "$forceRun" ]; then
        echo "Weekend, don't run"
        exit 0
    fi
    ;;
*) ;;
esac
# maybe add a monday morning delay (before noon?)