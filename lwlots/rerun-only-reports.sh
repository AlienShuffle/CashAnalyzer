#!/usr/bin/bash

workDir="${1:-.}"
./run-4-normalize.sh $workDir
./run-5-create-owner-list.sh $workDir
./run-6-create-addr-list.sh $workDir
./run-7-full-report.sh $workDir
./run-8-filtered-report.sh $workDir
./run-9-stats.sh $workDir
./run-b-compare.sh $workDir
./run-b-compare.sh --ignoreTaxes $workDir