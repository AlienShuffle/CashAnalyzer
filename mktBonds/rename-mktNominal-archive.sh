#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Usage: $0 [--apply] <cloudflare-folder>" >&2
    echo "Without --apply, show the planned renames without changing files." >&2
}

apply=false
directory=""
for arg in "$@"; do
    case "$arg" in
        --apply)
            apply=true
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        -*)
            usage
            exit 2
            ;;
        *)
            if [[ -n "$directory" ]]; then
                usage
                exit 2
            fi
            directory="$arg"
            ;;
    esac
done

if [[ -z "$directory" || ! -d "$directory" ]]; then
    usage
    exit 2
fi

files=()
destinations=()
while IFS= read -r -d '' file; do
    base=${file##*/}
    newBase=${base//mktNominal-curve-/mktNominal-grid-}
    files+=("$file")
    destinations+=("${file%/*}/$newBase")
done < <(find "$directory" -type f -name '*mktNominal-curve-*' -print0)

for i in "${!files[@]}"; do
    if [[ -e "${destinations[i]}" || -L "${destinations[i]}" ]]; then
        echo "Refusing to continue: destination already exists: ${destinations[i]}" >&2
        exit 1
    fi
done

manifests=()
while IFS= read -r -d '' manifest; do
    if grep -qF 'mktNominal-curve-' "$manifest"; then
        manifests+=("$manifest")
    fi
done < <(find "$directory" -type f -name 'mktNominal-manifest.txt' -print0)

if ! $apply; then
    for i in "${!files[@]}"; do
        printf 'rename: %q -> %q\n' "${files[i]}" "${destinations[i]}"
    done
    for manifest in "${manifests[@]}"; do
        printf 'update manifest: %q\n' "$manifest"
    done
    printf 'Dry run only. Re-run with --apply to make these changes.\n'
    exit 0
fi

for i in "${!files[@]}"; do
    mv -- "${files[i]}" "${destinations[i]}"
    printf 'renamed: %q -> %q\n' "${files[i]}" "${destinations[i]}"
done

for manifest in "${manifests[@]}"; do
    tmp=$(mktemp "${manifest}.tmp.XXXXXX")
    if ! sed 's/mktNominal-curve-/mktNominal-grid-/g' "$manifest" >"$tmp"; then
        rm -f -- "$tmp"
        echo "Failed to update manifest: $manifest" >&2
        exit 1
    fi
    mv -- "$tmp" "$manifest"
    printf 'updated manifest: %q\n' "$manifest"
done
