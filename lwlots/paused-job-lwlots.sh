#!/usr/bin/bash
cd $HOME/CashAnalyzer/lwlots
[ -d $HOME/CashAnalyzer/log ] || mkdir -p $HOME/CashAnalyzer/log
for script in $(ls ./run-?-*.sh); do
    echo ------------
    echo "Running $script @ $(date)"
    dir=$(dirname $script)
    scriptFile=$(basename $script)
    {
        cd $dir
        eval ./$scriptFile "$@"
        echo "Finished $scriptFile @ $(date) return code $?"
        [ $? -ne 0 ] && echo "Error processing $scriptFile" 1>&2 && exit 1
    }
    echo
done |
    tee -a log/cash-analyzer-jobs.log
