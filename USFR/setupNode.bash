echo If you need to update NVM, do the following:
echo steps to update NVM:
echo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

echo steps to get current long-term support (--lts) Node Versiom
echo nvm version
nvm version
echo nvm install --lts
nvm install --lts

echo we are going to update npm itself
npm install -g npm
npm install --lts

# update permissions.
for i in `ls job-*.bash`
do
  perm=`stat -c '%a' $i`
  echo "checking $i = $perm" 
  if [ "$perm" -ne 744 ]
  then
    echo changing permissions.
    chmod 744 $i
  fi
done