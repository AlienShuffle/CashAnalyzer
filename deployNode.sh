#!/usr/bin/bash
#
# Updates to the NPM/Node Environment This needs to be done in each directory
#
# Avoid Puppeteer attempting to download Chromium by default; can be overridden
# by exporting `PUPPETEER_SKIP_DOWNLOAD=false` in the environment before running.
PUPPETEER_SKIP_DOWNLOAD="${PUPPETEER_SKIP_DOWNLOAD:-true}"
export PUPPETEER_SKIP_DOWNLOAD

# If `PUPPETEER_EXECUTABLE_PATH` isn't set, try to find a system Chromium/Chrome
# and export it so Puppeteer can use the system browser instead of downloading.
if [ -z "$PUPPETEER_EXECUTABLE_PATH" ]; then
    for cmd in chromium-browser chromium google-chrome-stable google-chrome; do
        if command -v "$cmd" >/dev/null 2>&1; then
            PUPPETEER_EXECUTABLE_PATH="$(command -v $cmd)"
            export PUPPETEER_EXECUTABLE_PATH
            echo "Using system browser for Puppeteer: $PUPPETEER_EXECUTABLE_PATH"
            break
        fi
    done
fi

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
