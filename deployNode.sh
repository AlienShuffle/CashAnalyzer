#!/usr/bin/bash
#
# Updates to the NPM/Node Environment This needs to be done in each directory
#
rm -rf ~/.cache/puppeteer

# directories that need puppeteer or xml-parser use:
ROOT_DIR="${1:-.}"
find "$ROOT_DIR" -name package.json -not -path "*/node_modules/*" -not -path "*/.git/*" |
    while read package; do
        echo found $package
        dir=$(dirname $package)
        (
            cd $dir || exit
            echo "##### $dir"
            npm ci
            echo
        )
    done
echo Make sure all bash files are executable.
echo 'chmod +x *.sh */*.sh'
chmod +x *.sh */*.sh
