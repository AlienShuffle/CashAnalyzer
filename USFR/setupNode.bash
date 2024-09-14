echo steps to update NVM:
echo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

echo steps to get current long-term support (--lts) Node Versio
echo nvm version
nvm version
echo nvm install --lts
nvm install --lts
nvm version
nvm version

echo updating npm itself
npm install -g npm

npm install --lts
