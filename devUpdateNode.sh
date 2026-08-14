#!/usr/bin/bash

ROOT_DIR="${1:-.}"
find "$ROOT_DIR" -name package.json -not -path "*/node_modules/*" -not -path "*/.git/*" |
    while read package; do
        dir=$(dirname "$package")
        (
            cd "$dir" || exit

            echo "##### $dir"

            # remove node_modules and package-lock.json to ensure a clean install only deliberately.
            rm -rf node_modules
            #rm -f package-lock.json
            if grep -q '"puppeteer"' package.json; then
                npm install puppeteer@25.7.0
            fi
            npm install
            npm update

            if grep -q '"puppeteer"' package.json; then
                echo "Found puppeteer"
            fi
        )
    done
chmod +x *.sh */*.sh 2>/dev/null
