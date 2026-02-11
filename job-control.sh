#!/usr/bin/bash
cd $HOME/CashAnalyzer
[ -d $HOME/CashAnalyzer/log ] || mkdir -p $HOME/CashAnalyzer/log
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
    echo "sleep 90 minutes @ $(date)"
  ) | tee -a log/cash-analyzer-jobs.log
  sleep 90m
  echo '#####################################################################################'
done
exit 0
