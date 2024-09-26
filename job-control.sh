#!/usr/bin/bash
[ -d $HOME/CashAnalyzer/log ] || mkdir $HOME/CashAnalyzer/log
# Find all the scripts in each system sub-folder with prefix job- and run them with a 6 hour delay
while true; do
  logrotate --state $HOME/CashAnalyzer/log/status $HOME/CashAnalyzer/cashanalyzer.log.conf #| tee -a log/cash-analyzer-jobs.log
  (
    for script in $(ls */job-*.sh); do
      echo ------------
      echo "Running $script @ $(date)"
      dir=$(dirname $script)
      scriptFile=$(basename $script)
      (
        cd $dir
        eval ./$scriptFile
      )
      echo
    done
    echo "sleep 6 hours @ $(date)"
  ) | tee -a log/cash-analyzer-jobs.log
  sleep 6h
  echo '##################################'
done
exit 0
