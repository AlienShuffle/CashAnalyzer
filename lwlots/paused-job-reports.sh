#!/usr/bin/bash
cd $HOME/CashAnalyzer/lwlots
[ -d $HOME/CashAnalyzer/log ] || mkdir -p $HOME/CashAnalyzer/log
{
    #./run-1-retrieve-lot-list.sh
    #./run-2-retrieve-lot-details.sh
    #./run-3-retrieve-lot-taxes.sh
    ./run-4-normalize.sh
    ./run-5-create-owner-list.sh
    ./run-6-create-addr-list.sh
    ./run-7-full-report.sh
    ./run-8-filtered-report.sh
    ./run-9-stats.sh
    #./run-a-archive-reports.sh
    #./run-b-compare.sh
} |
    tee -a log/cash-analyzer-jobs.log
