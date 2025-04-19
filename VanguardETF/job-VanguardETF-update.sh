#!/usr/bin/bash
source ../meta.$(hostname).sh
source ../bin/skipWeekends.sh
for i in $(cat "$(basename $(pwd))-funds.txt"); do
    ./run-Vg-distro-update.sh --ticker $i "$@"
done
