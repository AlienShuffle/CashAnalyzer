#!/usr/bin/bash
for i in $(cat "$(basename $(pwd))-funds.txt"); do
    ./run-Vg-distro-update.sh --ticker $i "$@"
done
