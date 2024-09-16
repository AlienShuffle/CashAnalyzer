#!/usr/bin/bash
# Find all the scripts in each system sub-folder with prefix job- and run them with a 6 hour delay
while true
do
  [ -d $HOME/CashAnalyzer/log ] || mkdir $HOME/CashAnalyzer/log
  logrotate --state $HOME/CashAnalyzer/log/status $HOME/CashAnalyzer/cashanalyzer.log.conf | tee log/cash-analyzer-jobs.log
  (
    for script in `ls */job-*.bash`
    do
      echo ------------
      echo "Running $script @ `date`"
      dir=`dirname $script`
      scriptFile=`basename $script`
      (cd $dir; eval ./$scriptFile)
      echo
    done
    echo "sleep 6 hours @ `date`"
    sleep 6h
  ) | tee log/cash-analyzer-jobs.log
done
exit 0