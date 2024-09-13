#!/usr/bin/bash
# Find all the scripts in each system sub-folder with prefix job- and run them with a 6 hour delay
while true
do
  for script in `ls */job-*.bash`
  do
    echo ------------
    echo "Running $script"
    dir=`dirname $script`
    scriptFile=`basename $script`
    (cd $dir; eval ./$scriptFile)
    echo
  done
  echo "sleep 6 hours @ `date`"
  sleep 6h
done
exit 0