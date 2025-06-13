#!/usr/bin/bash
#
# npm maintenance tasks.
#
# If you need to update NVM, do the following:
#
echo "steps to update NVM (update the version number as appropriate)"
echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
echo "steps to get current long-term support (--lts) Node Version"
echo "##### Get latest Node version"
echo nvm version
echo nvm install --lts
echo [ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" 
echo nvm version
echo nvm install --lts
echo
echo "##### jq"
echo "Make sure jq is installed"
echo sudo apt install jq
#sudo apt install jq

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
        npm outdated || npm update
        echo
    )
done