#!/usr/bin/bash
cd $HOME/CashAnalyzer
[ -d $HOME/CashAnalyzer/log ] || mkdir -p $HOME/CashAnalyzer/log
# set sleep parameter default to 60 minutes or use argument if provided as a parameter --sleep
# (not passed on to the scripts)
while [ -n "$1" ]; do
  case $1 in
  "--sleep")
    SLEEP_TIME="$2"
    echo "SLEEP_TIME=$SLEEP_TIME"
    shift 2
    ;;
  *)
    # Stop processing - pass remaining args to child processes
    break
    ;;
  esac
done
SLEEP_TIME=${SLEEP_TIME:-60m}

# Find all the scripts in each system sub-folder with prefix job- and run them with a standard delay
while true; do
  logrotate --state $HOME/CashAnalyzer/log/status $HOME/CashAnalyzer/cashanalyzer.log.conf
  (
    for script in $(ls */job-*.sh); do
      echo ------------
      echo "Running $script @ $(date)"
      dir=$(dirname $script)
      scriptFile=$(basename $script)
      (
        cd $dir
        eval ./$scriptFile "$@"
      )
      echo
    done
    echo "sleep $SLEEP_TIME @ $(date)"
  ) | tee -a log/cash-analyzer-jobs.log
  sleep $SLEEP_TIME
  echo '#####################################################################################'
done
exit 0
