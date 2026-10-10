#!/usr/bin/env bash
#
# Push, version, and deploy the fintools Apps Script projects after a commit.
#
#   lib      fintools/lib                      push -> create version -> update library deployment
#   wrapper  fintools/wrapper                  push (stays on developmentMode / HEAD)
#   toolkit  mktBonds/toolkit-app-script-src   pin fintools version -> push -> commit pin
#
# Each project authenticates with the .clasp.auth file in its own directory.
#
# Usage: fintools/clasp-release.sh [options] [lib] [wrapper] [toolkit]
#   (no targets = all three, in that order)
#
# Options:
#   -n, --dry-run     Show what would run; make no remote or local changes.
#   --skip-checks     Skip clean-worktree, wrapper-sync and test prechecks.
#   --no-deploy       Create the lib version but do not move a deployment to it.
#   --no-commit       Update the toolkit pin but leave it uncommitted.
#   --pin <version>   Pin the toolkit to this fintools version (default: version
#                     just created by the lib step, else the current pin).
#   -h, --help        Show this help.
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIB_DIR="$REPO_ROOT/fintools/lib"
WRAPPER_DIR="$REPO_ROOT/fintools/wrapper"
TOOLKIT_DIR="$REPO_ROOT/mktBonds/toolkit-app-script-src"
TOOLKIT_MANIFEST="$TOOLKIT_DIR/appsscript.json"
FINTOOLS_LIBRARY_ID="1M2LjvkaLTyGVMIu2BgQB1KVPUKBP1Aydv8WL4PQSyFZQybXWkOAPzAhn"

DRY_RUN=0
SKIP_CHECKS=0
DEPLOY=1
COMMIT_PIN=1
PIN_VERSION=""
TARGETS=()

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }
die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "##### $*"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--dry-run) DRY_RUN=1 ;;
        --skip-checks) SKIP_CHECKS=1 ;;
        --no-deploy) DEPLOY=0 ;;
        --no-commit) COMMIT_PIN=0 ;;
        --pin) [[ $# -ge 2 ]] || die "--pin needs a version number"; PIN_VERSION="$2"; shift ;;
        -h|--help) usage; exit 0 ;;
        lib|wrapper|toolkit) TARGETS+=("$1") ;;
        all) TARGETS+=(lib wrapper toolkit) ;;
        *) die "unknown argument: $1 (see --help)" ;;
    esac
    shift
done
[[ ${#TARGETS[@]} -gt 0 ]] || TARGETS=(lib wrapper toolkit)
[[ -z "$PIN_VERSION" || "$PIN_VERSION" =~ ^[1-9][0-9]*$ ]] || die "--pin must be a positive integer"

has_target() { local t; for t in "${TARGETS[@]}"; do [[ "$t" == "$1" ]] && return 0; done; return 1; }

# Run clasp inside a project directory using that directory's credentials.
clasp_in() {
    local dir="$1"; shift
    [[ -f "$dir/.clasp.json" ]] || die "missing $dir/.clasp.json"
    [[ -f "$dir/.clasp.auth" ]] || die "missing $dir/.clasp.auth (run clasp login there)"
    if [[ $DRY_RUN -eq 1 ]]; then
        echo "[dry-run] (cd ${dir#"$REPO_ROOT"/} && clasp -A .clasp.auth$(printf ' %q' "$@"))" >&2
        return 0
    fi
    (cd "$dir" && clasp -A .clasp.auth "$@")
}

json_field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s)[process.argv[1]];if(v===undefined)process.exit(1);console.log(v)})' "$1"; }

current_pin() {
    node -e '
        const m = require(process.argv[1]);
        const lib = (m.dependencies?.libraries || []).find(l => l.libraryId === process.argv[2]);
        if (!lib) process.exit(1);
        console.log(lib.version);
    ' "$TOOLKIT_MANIFEST" "$FINTOOLS_LIBRARY_ID"
}

set_pin() {
    node -e '
        const fs = require("fs");
        const [file, id, version] = process.argv.slice(1);
        const m = JSON.parse(fs.readFileSync(file, "utf8"));
        const lib = (m.dependencies?.libraries || []).find(l => l.libraryId === id);
        if (!lib) { console.error("fintools library not found in " + file); process.exit(1); }
        lib.version = version;
        delete lib.developmentMode;
        fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
    ' "$TOOLKIT_MANIFEST" "$FINTOOLS_LIBRARY_ID" "$1"
}

command -v clasp >/dev/null || die "clasp not found on PATH"
command -v node >/dev/null || die "node not found on PATH"
cd "$REPO_ROOT"

GIT_SHA="$(git rev-parse --short HEAD)"
GIT_SUBJECT="$(git log -1 --format=%s)"
DESCRIPTION="$GIT_SHA ${GIT_SUBJECT:0:80}"
echo "Releasing [${TARGETS[*]}] from $DESCRIPTION$([[ $DRY_RUN -eq 1 ]] && echo ' (dry run)')"

if [[ $SKIP_CHECKS -eq 0 ]]; then
    step "Prechecks"
    dirty="$(git status --porcelain -- fintools mktBonds/toolkit-app-script-src mktBonds/test)"
    [[ -z "$dirty" ]] || die "uncommitted changes; commit before releasing:"$'\n'"$dirty"
    node fintools/sync-wrappers.mjs --check
    node --test mktBonds/test/*.test.mjs >/tmp/clasp-release-tests.$$ 2>&1 \
        || { cat /tmp/clasp-release-tests.$$; rm -f /tmp/clasp-release-tests.$$; die "tests failed"; }
    grep -E '^# (tests|pass|fail)' /tmp/clasp-release-tests.$$ || true
    rm -f /tmp/clasp-release-tests.$$
fi

NEW_VERSION=""

if has_target lib; then
    step "fintools/lib: push"
    clasp_in "$LIB_DIR" push --force

    step "fintools/lib: create version"
    if [[ $DRY_RUN -eq 1 ]]; then
        clasp_in "$LIB_DIR" version --json "$DESCRIPTION"
        NEW_VERSION="<new>"
    else
        NEW_VERSION="$(clasp_in "$LIB_DIR" version --json "$DESCRIPTION" | json_field versionNumber)" \
            || die "could not read the new version number"
    fi
    echo "Created fintools version $NEW_VERSION"

    if [[ $DEPLOY -eq 1 ]]; then
        step "fintools/lib: update library deployment"
        deployment_id=""
        if [[ $DRY_RUN -eq 0 ]]; then
            # Move the most recent versioned (non-HEAD) deployment; create one if none exists.
            deployment_id="$(clasp_in "$LIB_DIR" deployments --json | node -e '
                let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
                    const d = JSON.parse(s).filter(x => x.versionNumber)
                        .sort((a, b) => b.versionNumber - a.versionNumber)[0];
                    if (d) console.log(d.deploymentId);
                })')"
        fi
        if [[ $DRY_RUN -eq 1 ]]; then
            echo "[dry-run] redeploy the latest versioned deployment to $NEW_VERSION (or create one if none exist)"
        elif [[ -n "$deployment_id" ]]; then
            clasp_in "$LIB_DIR" redeploy "$deployment_id" -V "$NEW_VERSION" -d "$DESCRIPTION"
        else
            clasp_in "$LIB_DIR" deploy -V "$NEW_VERSION" -d "$DESCRIPTION"
        fi
    fi
fi

if has_target wrapper; then
    step "fintools/wrapper: push (developmentMode, no version pin)"
    clasp_in "$WRAPPER_DIR" push --force
fi

if has_target toolkit; then
    old_pin="$(current_pin)" || die "fintools dependency not found in $TOOLKIT_MANIFEST"
    target_pin="${PIN_VERSION:-${NEW_VERSION:-$old_pin}}"

    if [[ "$target_pin" != "$old_pin" ]]; then
        step "toolkit: pin fintools $old_pin -> $target_pin"
        if [[ $DRY_RUN -eq 1 ]]; then
            echo "[dry-run] set fintools version in ${TOOLKIT_MANIFEST#"$REPO_ROOT"/} to $target_pin"
        else
            set_pin "$target_pin"
        fi
    else
        echo; echo "toolkit: fintools pin unchanged ($old_pin)"
    fi

    step "toolkit: push"
    clasp_in "$TOOLKIT_DIR" push --force

    if [[ "$target_pin" != "$old_pin" ]]; then
        if [[ $DRY_RUN -eq 1 ]]; then
            [[ $COMMIT_PIN -eq 1 ]] && echo "[dry-run] git commit ${TOOLKIT_MANIFEST#"$REPO_ROOT"/}"
        elif [[ $COMMIT_PIN -eq 1 ]]; then
            step "toolkit: commit pin"
            git commit --quiet -m "Pin toolkit to fintools library version $target_pin" \
                -m "Released from $GIT_SHA." -- "$TOOLKIT_MANIFEST"
            git log -1 --oneline
        else
            echo "Pin change left uncommitted in ${TOOLKIT_MANIFEST#"$REPO_ROOT"/}"
        fi
    fi
fi

echo
echo "Done."
