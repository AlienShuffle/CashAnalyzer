#!/usr/bin/bash
#
# Reset debugging and logging history so a fresh test run starts with a clean slate.
#   - empties every <source>/debug/ directory (the directory itself is kept)
#   - deletes rotated job logs (log/cash-analyzer-jobs.log.N)
#   - truncates log/cash-analyzer-jobs.log in place (safe even if job-control.sh is running)
#   - optionally (--include-backup-log) does the same for $HOME/log/CA_backup.log*
#
# usage: bin/cleanup-debug-logs.sh [-n|--dry-run] [-y|--yes] [--include-backup-log]
#
usage() {
    sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

dryRun=false
assumeYes=false
includeBackupLog=false
while [ -n "$1" ]; do
    case $1 in
    -n | --dry-run) dryRun=true ;;
    -y | --yes) assumeYes=true ;;
    --include-backup-log) includeBackupLog=true ;;
    -h | --help) usage 0 ;;
    *)
        echo "unknown option: $1" >&2
        usage 1
        ;;
    esac
    shift
done

caHome="$(cd "$(dirname "$0")/.." && pwd)"
cd "$caHome" || exit 1

if pgrep -f 'job-control.sh' >/dev/null || pgrep -f '/job-[^/]*\.sh' >/dev/null; then
    echo "WARNING: job-control.sh or a job script appears to be running; files from an in-progress run may be removed."
fi

# collect targets
removeList=()
for dir in */debug; do
    [ -d "$dir" ] || continue
    for f in "$dir"/* "$dir"/.[!.]*; do
        [ -e "$f" ] || continue
        # keep the stderr capture file of a job that is still running
        if [[ "$(basename "$f")" =~ ^stderr-([0-9]+)\.txt$ ]] && kill -0 "${BASH_REMATCH[1]}" 2>/dev/null; then
            continue
        fi
        removeList+=("$f")
    done
done
for f in log/cash-analyzer-jobs.log.*; do
    [ -e "$f" ] && removeList+=("$f")
done
truncateList=()
[ -s log/cash-analyzer-jobs.log ] && truncateList+=("log/cash-analyzer-jobs.log")

if $includeBackupLog; then
    for f in "$HOME"/log/CA_backup.log.*; do
        [ -e "$f" ] && removeList+=("$f")
    done
    [ -s "$HOME/log/CA_backup.log" ] && truncateList+=("$HOME/log/CA_backup.log")
fi

if [ ${#removeList[@]} -eq 0 ] && [ ${#truncateList[@]} -eq 0 ]; then
    echo "Nothing to clean up in $caHome."
    exit 0
fi

echo "CashAnalyzer home: $caHome"
echo "To remove (${#removeList[@]}):"
for f in "${removeList[@]}"; do
    echo "    $f ($(du -sh "$f" 2>/dev/null | cut -f1))"
done
echo "To truncate (${#truncateList[@]}):"
for f in "${truncateList[@]}"; do
    echo "    $f ($(du -sh "$f" 2>/dev/null | cut -f1))"
done

if $dryRun; then
    echo "Dry run, nothing changed."
    exit 0
fi
if ! $assumeYes; then
    read -r -p "Proceed? [y/N] " answer
    [[ "$answer" =~ ^[Yy] ]] || {
        echo "Aborted."
        exit 1
    }
fi

status=0
for f in "${removeList[@]}"; do
    rm -rf -- "$f" || status=1
done
for f in "${truncateList[@]}"; do
    : >"$f" || status=1
done
echo "Cleanup complete @ $(date)"
exit $status
