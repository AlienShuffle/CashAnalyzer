import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseIoArgs } from '../jsonIO.mjs';

const sorterPath = fileURLToPath(new URL('../node-MM-sortBest.js', import.meta.url));
const rows = [
    { ticker: 'FTEXX', source: 'fidelity', sevenDayYield: 0.04, asOfDate: '2026-10-06' },
    { ticker: 'FTEXX', source: 'fidelity', sevenDayYield: 0.041, asOfDate: '2026-10-07' },
];

function run(args, options = {}) {
    return spawnSync(process.execPath, [sorterPath, ...args], {
        encoding: 'utf8',
        env: { ...process.env, oldestDate: '2020-01-01' },
        ...options,
    });
}

function withTempDir(fn) {
    const dir = mkdtempSync(join(tmpdir(), 'jsonIO-'));
    try {
        fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('parseIoArgs separates --input/--output from script arguments', () => {
    assert.deepEqual(parseIoArgs(['latest', '--input', 'a.json', '--output=b.json', 'x']),
        { input: 'a.json', output: 'b.json', args: ['latest', 'x'] });
    assert.deepEqual(parseIoArgs([]), { input: undefined, output: undefined, args: [] });
    assert.throws(() => parseIoArgs(['--input']), /requires a file path/);
});

test('--input/--output reads and writes files without using stdin', () => withTempDir(dir => {
    const input = join(dir, 'in.json');
    const output = join(dir, 'out.json');
    writeFileSync(input, JSON.stringify(rows));
    const result = run(['latest', '--input', input, '--output', output], { stdio: ['ignore', 'pipe', 'pipe'] });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), [rows[1]]);
    assert.deepEqual(readdirSync(dir).sort(), ['in.json', 'out.json']);
}));

test('stdin/stdout fallback still works', () => {
    const result = run([], { input: JSON.stringify(rows) });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), rows);
});

test('invalid input fails without creating or replacing the output file', () => withTempDir(dir => {
    const input = join(dir, 'in.json');
    const output = join(dir, 'out.json');
    writeFileSync(input, '[{"ticker": "FTEXX"');
    writeFileSync(output, 'previous');
    const result = run(['--input', input, '--output', output]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /invalid JSON/);
    assert.equal(readFileSync(output, 'utf8'), 'previous');
    assert.deepEqual(readdirSync(dir).sort(), ['in.json', 'out.json']);

    const missing = run(['--input', join(dir, 'missing.json'), '--output', output]);
    assert.equal(missing.status, 1);
    assert.equal(readFileSync(output, 'utf8'), 'previous');
}));
