#
# script uses a node process to compare two .json files and if it returns true they are identical
# ignores the 'timstamp' element.
# this returns shell true (0) if the files are the different
# This is opposite of diff, but in the logic of the environment where we do something (publish) if the files are different.
#
val=$(node ../lib/node-deepCompare.js $1 $2)
if [ "$val" = "true" ]; then
    exit 1 # true means the files are the same.
else
    exit 0 # return bash 0 (aka true) if the files are different (compare false).
fi
