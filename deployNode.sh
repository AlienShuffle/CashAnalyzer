#!/usr/bin/bash
#
# Updates to the NPM/Node Environment This needs to be done in each directory
#
# directories that need puppeteer or xml-parser use:
for package in $(ls */package.json); do
    echo found $package
    dir=$(dirname $package)
    (
        cd $dir
        echo "##### $dir"
        npm ci
        echo
    )
done
echo Make sure all bash files are executable.
echo 'chmod +x *.sh */*.sh'
chmod +x *.sh */*.sh
