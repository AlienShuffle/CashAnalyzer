#!/usr/bin/bash
#
# One Time Setup Tasks.
#
echo If you need to update NVM, do the following:
echo steps to update NVM:
echo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

echo install jq (this gives v1.6 currently)
sudo apt install jq

#
# Updates to the NPM/Node Environment This needs to be done in each directory
#
for dir in Ally USFR; do
    (
        cd $dir

        echo steps to get current long-term support (--lts) Node Versiom
        echo nvm version
        nvm version
        echo nvm install --lts
        nvm install --lts

        echo we are going to update npm itself
        npm install -g npm
        npm install --lts
    )
done