#!/usr/bin/bash
source ../meta.$(hostname).sh
dir=$(dirname $cloudFlareHome)
echo "cd $dir"
cd "$dir"
echo "git pull"
git pull