#
# script uses a node process to compare two .json files and if it returns true they are identical
# ignores the 'timestamp' element.
# This script returns shell true (0) if the files are the different
# This is opposite of diff, but appropriate logic of the environment; we do something (publish) if the files are different.

# if file1 is missing or empty, return same if file2 is missing or empty, otherwise, they are differnt.
if [ ! -s "$1" ]; then
    [ ! -s "$2" ] && exit 1
    exit 0
fi
# if file2 is missing or empty, return same if file1 is missing or empty, otherwise, they are differnt.
if [ ! -s "$2" ]; then
    [ ! -s "$1" ] && exit 1
    exit 0
fi
# we have two non-empty files, compare them using the node deep object compare app.
val=$(node ../lib/node-deepCompare.js "$1" "$2")
# return bash 1 (aka false/fail) - deepCompare returns true if the files are the same.
[ "$val" = "true" ] && exit 1
# return bash 0 (aka true) if the files are different (deepCompare false).
exit 0
