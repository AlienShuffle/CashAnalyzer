#!/usr/bin/bash
#
# One Time Setup Tasks.
#
echo If you need to update NVM, do the following:s
echo steps to update NVM:
echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
echo "steps to get current long-term support (--lts) Node Version"
echo "nvm version"
echo "nvm install --lts"
echo
echo "install jq (this gives v1.6 currently on WSL)"
sudo apt install jq

#
# Updates to the NPM/Node Environment This needs to be done in each directory
#
for dir in Ally USFR; do
    (
        cd $dir
        echo "we are going to update npm and the node libraries"
        npm install -g npm
        npm install --lts
    )
done