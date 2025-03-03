#!/usr/bin/bash
#
# One Time Setup Tasks.
#
#echo If you need to update NVM, do the following:s
#echo steps to update NVM:
#echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
#echo "steps to get current long-term support (--lts) Node Version"
echo "##### Get latest Node version"
echo "nvm version"
echo "nvm install --lts"
[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh" 
nvm version
nvm install --lts
echo
echo "##### jq"
echo "Make sure jq is installed"
echo sudo apt install jq
sudo apt install jq

#
# Updates to the NPM/Node Environment This needs to be done in each directory
#
for dir in Ally FedInvest FedInvestToday PaPower TIPS Treasury USFR Vanguard yieldFinder yieldMM; do
    (
        cd $dir
        echo "##### $dir"
        echo "Update npm and the node libraries"
        npm install -g npm
        npm install --lts
        echo
    )
done
