#!/usr/bin/bash
source ../meta.$(hostname).sh
echo "cd $cloudFlareHome/.."
cd "$cloudFlareHome/.."
echo "git pull"
git pull