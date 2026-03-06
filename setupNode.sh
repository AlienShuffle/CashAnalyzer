#!/usr/bin/bash
#
# npm maintenance tasks.
#
# If you need to update NVM, do the following:
#
echo "Manual steps required to update NVM"
echo "check the nvm Github: https://github.com/nvm-sh/nvm"
echo "update this script to latest version #"
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"
if ! command -v nvm >/dev/null; then
    echo getting latest known nvm version.
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
fi
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"
echo "##### Get latest Node version"
echo nvm version
nvm version
echo nvm install --lts
nvm install --lts
#echo
#echo "##### jq"
#echo "Make sure jq and tree is installed"
#echo sudo apt install jq tree
#sudo apt install jq tree
echo npm outdated -g || npm update -g
npm outdated -g || npm update -g
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
echo 'chmod +x */*.sh'
chmod +x */*.sh
