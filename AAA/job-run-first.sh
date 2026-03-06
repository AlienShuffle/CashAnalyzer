#!/bin/bash
source ../meta.common.sh
repoDir=$(dirname $cloudFlareHome)
if [ ! -d "$repoDir/.git" ]; then
    echo "$0: we are running on a non-git cloudflare tree, skipping sync process."
    exit 1
fi

echo "cd $repoDir"
cd "$repoDir"
echo "git pull"
git pull