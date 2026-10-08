import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sorterPath = fileURLToPath(new URL('../node-MM-sortBest.js', import.meta.url));

function row(source, sevenDayYield, asOfDate = '2026-10-06') {
    return { ticker: 'FTEXX', source, sevenDayYield, asOfDate };
}

function sort(rows, latest = false) {
    const result = spawnSync(process.execPath, [sorterPath, ...(latest ? ['latest'] : [])], {
        input: JSON.stringify(rows),
        encoding: 'utf8',
        env: { ...process.env, oldestDate: '2020-01-01' }
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}

test('removes exact 1% CNBC yields for all six source names, case-insensitively', () => {
    for (const source of ['cnbc', 'cnbc0', 'cnbc1', 'cnbc2', 'cnbc3', 'cnbc4', 'CNBC']) {
        assert.deepEqual(sort([row(source, 0.01)]), []);
        assert.deepEqual(sort([row(source, 0.0425)]), [row(source, 0.0425)]);
        assert.deepEqual(sort([row(source, 0.009999)]), [row(source, 0.009999)]);
    }
});

test('preserves other sources and allows a lower-priority valid same-date record', () => {
    for (const source of ['fidelity', 'nasdaq', 'unrelated-cnbc']) {
        assert.deepEqual(sort([row(source, 0.01)]), [row(source, 0.01)]);
    }
    assert.deepEqual(sort([row('cnbc', 0.01), row('nasdaq', 0.035)]),
        [row('nasdaq', 0.035)]);
});

test('regenerates contaminated gap fillers using the preceding valid yield', () => {
    const output = sort([
        row('cnbc', 0.0425, '2026-10-05'),
        row('cnbc', 0.01, '2026-10-06'),
        row('gapFiller (cnbc)', 0.01, '2026-10-07'),
        row('cnbc', 0.043, '2026-10-08')
    ]);
    assert.deepEqual(output.map(item => [item.asOfDate, item.sevenDayYield, item.source]), [
        ['2026-10-05', 0.0425, 'cnbc'],
        ['2026-10-06', 0.0425, 'gapFiller (cnbc)'],
        ['2026-10-07', 0.0425, 'gapFiller (cnbc)'],
        ['2026-10-08', 0.043, 'cnbc']
    ]);
});

test('latest mode ignores a newer contaminated record', () => {
    const valid = row('cnbc', 0.0425, '2026-10-05');
    assert.deepEqual(sort([valid, row('cnbc', 0.01, '2026-10-06')], true), [valid]);
});
