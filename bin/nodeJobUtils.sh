#!/usr/bin/bash
# Shared helpers for the *-update-common-job.sh scripts (source this file).
#
# Node is never fed through a pipe: node v24.21.0 intermittently crashed reading piped stdin
# (fs.readFileSync(0)), and the truncated output of `... | node | jq . >file` pipelines got published.
# Every step reads and writes files and its exit status is checked before the next step runs.
#
# If $errFile is set, node/jq stderr is appended to it, otherwise it goes to the caller's stderr.

# true if the file is a non-empty JSON array.
isJsonArray() {
    [ -s "$1" ] && jq -e 'type == "array" and length > 0' "$1" >/dev/null 2>&1
}
isEmptyJsonArray() {
    [ -s "$1" ] && jq -e 'type == "array" and length == 0' "$1" >/dev/null 2>&1
}
# true if every element of the given status list is zero.
pipeOk() {
    local s
    for s in "$@"; do [ "$s" -eq 0 ] || return 1; done
}
# usage: runNode <outFile> <stdinFile|-> <node args...>
#   runs node with stdin redirected from a file (or /dev/null), then pretty prints its output into <outFile> with jq.
#   sets statuses=(nodeStatus jqStatus); the raw node output is kept in <outFile>.raw only when a step fails.
runNode() {
    local out="$1" in="$2" raw="$1.raw" err="${errFile:-/dev/stderr}" nodeStatus jqStatus=0
    shift 2
    [ "$in" = "-" ] && in=/dev/null
    node "$@" <"$in" >"$raw" 2>>"$err"
    nodeStatus=$?
    if [ "$nodeStatus" -eq 0 ]; then
        jq . "$raw" >"$out" 2>>"$err"
        jqStatus=$?
    fi
    statuses=("$nodeStatus" "$jqStatus")
    pipeOk "${statuses[@]}" && rm -f "$raw"
}
# usage: publishFile <srcFile> <destFile>  - atomically replace destFile with a copy of srcFile.
publishFile() {
    cp "$1" "$2.tmp.$$" && mv -f "$2.tmp.$$" "$2" || {
        echo "failed to write $2"
        rm -f "$2.tmp.$$"
        return 1
    }
}
