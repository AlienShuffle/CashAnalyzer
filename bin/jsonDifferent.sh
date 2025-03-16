#
# script uses a node process to compare two .json files and if it returns true they are identical
# ignores the 'timstamp' element.
# this returns shell true (0) if the files are the different
# This is opposite of diff, but in the logic of the environment where we do something (publish) if the files are different.
#
# if file1 is missing or empty, return same if file2 is missing or empty, otherwise, they are differnt.
if [ ! -s "$1" ]; then
    if [ ! -s "$2" ]; then
        exit 1
    fi
    exit 0
fi
# if file2 is missing or empty, return same if file1 is missing or empty, otherwise, they are differnt.
if [ ! -s "$2" ]; then
    if [ ! -s "$1" ]; then
        exit 1
    fi
    exit 0
fi
# we have two non-zero files, compare them using the node deep object compare app.
val=$(node ../lib/node-deepCompare.js "$1" "$2")
if [ "$val" = "true" ]; then
    exit 1 # return bash 1 (aka false/fail) - deepCompare true means the files are the same.    
fi
exit 0 # return bash 0 (aka true) if the files are different (compare false).