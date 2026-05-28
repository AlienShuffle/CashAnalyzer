#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path


def trim_json_location(path: Path) -> int:
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise ValueError(f"JSON must contain an array at top level: {path}")

    trimmed = 0
    for item in data:
        if isinstance(item, dict) and 'location' in item:
            value = item['location']
            if isinstance(value, str):
                trimmed_value = value.strip()
                if trimmed_value != value:
                    item['location'] = trimmed_value
                    trimmed += 1

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return trimmed


def trim_csv_location(path: Path) -> int:
    with path.open('r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError(f"CSV file has no header row: {path}")

        fieldnames = reader.fieldnames
        location_keys = [name for name in fieldnames if name.strip().lower() == 'location']
        if not location_keys:
            raise ValueError(f"CSV file does not contain a 'location' column: {path}")

        location_key = location_keys[0]
        rows = list(reader)

    trimmed = 0
    for row in rows:
        if row is None:
            continue
        value = row.get(location_key)
        if value is not None:
            trimmed_value = value.strip()
            if trimmed_value != value:
                row[location_key] = trimmed_value
                trimmed += 1

    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)

    return trimmed


def collect_target_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]

    if path.is_dir():
        found = []
        # Support top-level folder and history directories that contain 2-lot-detail files.
        for candidate in [path, *path.iterdir()]:
            if not candidate.exists():
                continue
            if candidate.is_dir():
                for name in ('2-lot-detail.json', '2-lot-detail.csv'):
                    file_path = candidate / name
                    if file_path.exists():
                        found.append(file_path)
            else:
                if candidate.name in ('2-lot-detail.json', '2-lot-detail.csv'):
                    found.append(candidate)
        return sorted(found)

    raise ValueError(f"Unsupported path: {path}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Trim leading/trailing spaces from the location field in JSON and CSV lot-detail files.'
    )
    parser.add_argument('paths', nargs='+', help='Input files or directories to process')
    args = parser.parse_args()

    total_trimmed = 0
    target_files = []
    for arg in args.paths:
        path = Path(arg)
        if not path.exists():
            raise FileNotFoundError(f"Path not found: {path}")
        target_files.extend(collect_target_files(path))

    if not target_files:
        raise ValueError('No matching 2-lot-detail files found to process.')

    for path in target_files:
        if path.suffix.lower() == '.json':
            trimmed = trim_json_location(path)
            print(f"Trimmed {trimmed} JSON location value(s) in {path}")
        elif path.suffix.lower() == '.csv':
            trimmed = trim_csv_location(path)
            print(f"Trimmed {trimmed} CSV location value(s) in {path}")
        else:
            raise ValueError(f"Unsupported file type: {path}")

        total_trimmed += trimmed

    print(f"Total trimmed values: {total_trimmed}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
