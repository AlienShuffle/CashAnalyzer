#!/usr/bin/bash
source ../meta.common.sh
dir=$(dirname $cloudFlareHome)
echo "cd $dir"
cd "$dir"
echo "git pull"
git pull