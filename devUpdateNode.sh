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
        if grep puppeteer package.json; then
            grep puppeteer package-lock.json >/dev/null || npm install puppeteer
        fi
        if grep fast-xml-parser package.json; then
            grep fast-xml-parser package-lock.json >/dev/null || npm install fast-xml-parser
        fi
        if grep node-html-parser package.json; then
            grep node-html-parser package-lock.json >/dev/null || npm install node-html-parser
        fi
        npm outdated || npm update
        echo
    )
done
echo Make sure all bash files are executable.
echo 'chmod +x *.sh */*.sh'
chmod +x *.sh */*.sh
