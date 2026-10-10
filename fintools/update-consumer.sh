#!/usr/bin/env bash
#
# Update an Apps Script project that consumes the fintools library: refresh its
# fintools wrapper files from fintools/wrapper and pin its library version.
#
# Intended for tightly release-controlled sheets; nothing is changed without
# confirmation, and nothing is pushed unless --push is given.
#
# Usage: fintools/update-consumer.sh [options] <project-dir>
#
#   <project-dir>     Any local clasp project (inside or outside this repo).
#
# Only generated fintools wrapper files that already exist in <project-dir> are
# replaced; all other files (onOpen.js, sheet-specific scripts, ...) are never
# touched. appsscript.json is modified only to change the fintools pin.
#
# Options:
#   -V, --version <n>  Pin fintools to version n (default: latest library version,
#                      read with fintools/lib/.clasp.auth).
#   --add <file>       Also add a wrapper file not yet in the project (repeatable),
#                      e.g. --add fintools.Yahoo.js
#   --list             List available wrapper files and exit.
#   --keep-dev-mode    Leave an existing developmentMode setting unchanged
#                      (default removes it so the pinned version is used).
#   --push             clasp push the project afterwards (uses <project-dir>/.clasp.auth
#                      when present, else your default clasp login).
#   -y, --yes          Do not ask for confirmation.
#   -n, --dry-run      Show the plan only.
#   -h, --help         Show this help.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER_DIR="$REPO_ROOT/fintools/wrapper"
LIB_DIR="$REPO_ROOT/fintools/lib"
FINTOOLS_LIBRARY_ID="1M2LjvkaLTyGVMIu2BgQB1KVPUKBP1Aydv8WL4PQSyFZQybXWkOAPzAhn"

VERSION=""
ADD_FILES=()
KEEP_DEV=0
PUSH=0
YES=0
DRY_RUN=0
LIST=0
TARGET=""

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }
die() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARNING: $*" >&2; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        -V|--version) [[ $# -ge 2 ]] || die "$1 needs a version number"; VERSION="$2"; shift ;;
        --add) [[ $# -ge 2 ]] || die "--add needs a file name"; ADD_FILES+=("$(basename "$2")"); shift ;;
        --list) LIST=1 ;;
        --keep-dev-mode) KEEP_DEV=1 ;;
        --push) PUSH=1 ;;
        -y|--yes) YES=1 ;;
        -n|--dry-run) DRY_RUN=1 ;;
        -h|--help) usage; exit 0 ;;
        -*) die "unknown option: $1 (see --help)" ;;
        *) [[ -z "$TARGET" ]] || die "only one project directory may be given"; TARGET="$1" ;;
    esac
    shift
done

command -v node >/dev/null || die "node not found on PATH"

# Generated canonical wrapper files (never onOpen.js or appsscript.json).
mapfile -t WRAPPER_FILES < <(cd "$REPO_ROOT" && node --input-type=module -e '
    import { wrapperPlans } from "./fintools/sync-wrappers.mjs";
    import path from "node:path";
    const dir = path.resolve("fintools/wrapper") + path.sep;
    const files = wrapperPlans().map(p => decodeURIComponent(p.url.pathname))
        .filter(p => p.startsWith(dir)).map(p => path.basename(p));
    console.log([...new Set(files)].sort().join("\n"));
')
[[ ${#WRAPPER_FILES[@]} -gt 0 ]] || die "no generated wrapper files found"
is_wrapper() { local f; for f in "${WRAPPER_FILES[@]}"; do [[ "$f" == "$1" ]] && return 0; done; return 1; }

if [[ $LIST -eq 1 ]]; then
    printf '%s\n' "${WRAPPER_FILES[@]}"
    exit 0
fi

[[ -n "$TARGET" ]] || { usage; exit 1; }
TARGET="$(cd "$TARGET" 2>/dev/null && pwd)" || die "no such directory: $TARGET"
MANIFEST="$TARGET/appsscript.json"
[[ -f "$TARGET/.clasp.json" ]] || die "$TARGET is not a clasp project (no .clasp.json)"
[[ -f "$MANIFEST" ]] || die "missing $MANIFEST"
[[ "$TARGET" != "$WRAPPER_DIR" ]] || die "target is the canonical wrapper directory"
[[ -z "$VERSION" || "$VERSION" =~ ^[1-9][0-9]*$ ]] || die "--version must be a positive integer"
for f in "${ADD_FILES[@]+"${ADD_FILES[@]}"}"; do
    is_wrapper "$f" || die "--add $f is not a generated wrapper file (see --list)"
done

# Make sure the wrapper sources are current and committed before distributing them.
(cd "$REPO_ROOT" && node fintools/sync-wrappers.mjs --check >/dev/null) \
    || die "fintools wrappers are out of sync; run node fintools/sync-wrappers.mjs --write"
if [[ -n "$(cd "$REPO_ROOT" && git status --porcelain -- fintools/lib fintools/wrapper)" ]]; then
    warn "uncommitted changes under fintools/lib or fintools/wrapper; wrappers may not match any published version"
fi

# Resolve the library version.
VERSION_DESC=""
if [[ -z "$VERSION" || -f "$LIB_DIR/.clasp.auth" ]]; then
    versions_json=""
    if [[ -f "$LIB_DIR/.clasp.auth" ]] && command -v clasp >/dev/null; then
        versions_json="$(cd "$LIB_DIR" && clasp -A .clasp.auth versions --json 2>/dev/null)" || versions_json=""
    fi
    if [[ -n "$versions_json" ]]; then
        read -r latest_version latest_desc < <(node -e '
            const want = process.argv[1];
            const list = JSON.parse(process.argv[2]).filter(v => v.versionNumber);
            const v = want ? list.find(x => String(x.versionNumber) === want)
                           : list.sort((a, b) => b.versionNumber - a.versionNumber)[0];
            if (!v) process.exit(1);
            console.log(v.versionNumber, (v.description || "").replace(/\s+/g, " "));
        ' "$VERSION" "$versions_json") || die "fintools version ${VERSION:-<latest>} not found"
        VERSION="$latest_version"
        VERSION_DESC="${latest_desc:-}"
    elif [[ -z "$VERSION" ]]; then
        die "could not list fintools versions; pass --version <n>"
    fi
fi

# Versions created by clasp-release.sh start with the git short SHA; verify that the
# wrappers being distributed match the library code that version was built from.
release_sha="${VERSION_DESC%% *}"
if [[ "$release_sha" =~ ^[0-9a-f]{7,40}$ ]] && (cd "$REPO_ROOT" && git cat-file -e "$release_sha^{commit}" 2>/dev/null); then
    if ! (cd "$REPO_ROOT" && git diff --quiet "$release_sha" HEAD -- fintools/lib fintools/wrapper); then
        warn "fintools/lib or fintools/wrapper changed since $release_sha (version $VERSION);"
        warn "the wrappers may call functions that version $VERSION does not have."
    fi
elif [[ -n "$VERSION_DESC" ]]; then
    warn "cannot match version $VERSION ('$VERSION_DESC') to a commit; verify wrappers match it."
else
    warn "version $VERSION was not verified against the library (no lib credentials); verify wrappers match it."
fi

# Plan file updates.
UPDATES=()
for f in "${WRAPPER_FILES[@]}"; do
    if [[ -f "$TARGET/$f" ]] || printf '%s\n' "${ADD_FILES[@]+"${ADD_FILES[@]}"}" | grep -qx "$f"; then
        UPDATES+=("$f")
    fi
done

fn_list() { [[ -f "$1" ]] && grep -oE '^function [A-Za-z0-9_$]+' "$1" | cut -d' ' -f2 | sort || true; }

echo "Project:  $TARGET"
echo "Script:   $(node -e 'console.log(require(process.argv[1]).scriptId)' "$TARGET/.clasp.json")"
echo "Source:   fintools/wrapper @ $(cd "$REPO_ROOT" && git log -1 --format='%h %s' -- fintools/wrapper)"
echo

changed=0
echo "Wrapper files:"
for f in "${UPDATES[@]+"${UPDATES[@]}"}"; do
    if [[ ! -f "$TARGET/$f" ]]; then
        echo "  ADD     $f"; changed=1
    elif cmp -s "$WRAPPER_DIR/$f" "$TARGET/$f"; then
        echo "  same    $f"; continue
    else
        echo "  UPDATE  $f"; changed=1
    fi
    while read -r line; do [[ -n "$line" ]] && echo "            $line"; done < <(
        diff <(fn_list "$TARGET/$f") <(fn_list "$WRAPPER_DIR/$f") | sed -n 's/^> /+ /p; s/^< /- /p')
done
[[ ${#UPDATES[@]} -gt 0 ]] || echo "  (none; use --add to include wrapper files)"
skipped=()
for f in "${WRAPPER_FILES[@]}"; do [[ -f "$TARGET/$f" ]] || printf '%s\n' "${UPDATES[@]+"${UPDATES[@]}"}" | grep -qx "$f" || skipped+=("$f"); done
[[ ${#skipped[@]} -eq 0 ]] || echo "  not in project (use --add): ${skipped[*]}"

echo
manifest_state="$(node -e '
    const m = require(process.argv[1]);
    const lib = (m.dependencies?.libraries || []).find(l => l.libraryId === process.argv[2]);
    if (!lib) process.exit(1);
    console.log(lib.version, lib.developmentMode === true);
' "$MANIFEST" "$FINTOOLS_LIBRARY_ID")" || die "fintools library dependency not found in $MANIFEST"
read -r old_version old_dev <<<"$manifest_state"
new_dev="false"; [[ $KEEP_DEV -eq 1 ]] && new_dev="$old_dev"
echo "fintools pin: version $old_version$([[ $old_dev == true ]] && echo ' (developmentMode)') -> version $VERSION$([[ $new_dev == true ]] && echo ' (developmentMode)')${VERSION_DESC:+  [$VERSION_DESC]}"
manifest_change=0
[[ "$old_version" != "$VERSION" || "$old_dev" != "$new_dev" ]] && manifest_change=1 && changed=1
[[ "$new_dev" == "true" ]] && warn "developmentMode stays on: the sheet will run library HEAD, not version $VERSION"
echo

if [[ $changed -eq 0 ]]; then
    echo "Project is already up to date."
    [[ $PUSH -eq 0 ]] && exit 0
fi
if [[ $DRY_RUN -eq 1 ]]; then
    echo "Dry run; no changes made."
    exit 0
fi
if [[ $YES -eq 0 ]]; then
    read -r -p "Apply$([[ $PUSH -eq 1 ]] && echo ' and push') these changes? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

if [[ $changed -eq 1 ]]; then
    # Back up outside the project so clasp never uploads it.
    backup="$(mktemp -d "${TMPDIR:-/tmp}/fintools-update-$(basename "$TARGET")-XXXXXX")"
    cp -p "$MANIFEST" "$backup/"
    for f in "${UPDATES[@]+"${UPDATES[@]}"}"; do [[ -f "$TARGET/$f" ]] && cp -p "$TARGET/$f" "$backup/"; done
    echo "Backup: $backup"

    for f in "${UPDATES[@]+"${UPDATES[@]}"}"; do cp "$WRAPPER_DIR/$f" "$TARGET/$f"; done
    if [[ $manifest_change -eq 1 ]]; then
        node -e '
            const fs = require("fs");
            const [file, id, version, keepDev] = process.argv.slice(1);
            const text = fs.readFileSync(file, "utf8");
            const m = JSON.parse(text);
            const lib = m.dependencies.libraries.find(l => l.libraryId === id);
            lib.version = version;
            if (keepDev !== "1") delete lib.developmentMode;
            fs.writeFileSync(file, JSON.stringify(m, null, 2) + (text.endsWith("\n") ? "\n" : ""));
        ' "$MANIFEST" "$FINTOOLS_LIBRARY_ID" "$VERSION" "$KEEP_DEV"
    fi
    echo "Updated $TARGET"
fi

if [[ $PUSH -eq 1 ]]; then
    command -v clasp >/dev/null || die "clasp not found on PATH"
    auth=(); [[ -f "$TARGET/.clasp.auth" ]] && auth=(-A .clasp.auth)
    (cd "$TARGET" && clasp "${auth[@]+"${auth[@]}"}" push --force)
else
    echo "Not pushed. Review, then: (cd \"$TARGET\" && clasp$([[ -f "$TARGET/.clasp.auth" ]] && echo ' -A .clasp.auth') push)"
fi
