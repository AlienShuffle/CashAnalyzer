#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
files=$(ls *.csv *.json | grep -v package)
date=$(date +%Y-%m-%d)
target="history/$date"
mkdir -p "$target"
eval mv $files "$target/"