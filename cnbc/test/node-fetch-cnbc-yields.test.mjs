import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const collectorUrl = new URL('../node-fetch-cnbc-yields.js', import.meta.url).href;

function collect(values) {
    const priceBars = values.map((close, i) => ({
        tradeTime: `202610${String(i + 1).padStart(2, '0')}000000`,
        close
    }));
    const script = `
        globalThis.fetch = async () => ({
            json: async () => ({ data: { chartData: { priceBars: ${JSON.stringify(priceBars)} } } })
        });
        await import(${JSON.stringify(collectorUrl)});
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        input: 'FTEXX\n',
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    return { rows: JSON.parse(result.stdout), stderr: result.stderr };
}

test('preserves valid yields including the final bar and a single-bar response', () => {
    const { rows, stderr } = collect([4.25, 4.3]);
    assert.deepEqual(rows.map(row => row.sevenDayYield), [0.0425, 0.043]);
    assert.deepEqual(rows.map(row => row.asOfDate), ['2026-10-01', '2026-10-02']);
    assert(rows.every(row => row.price === 1 && row.source === 'cnbc'
        && row.ticker === 'FTEXX' && Number.isFinite(Date.parse(row.timestamp))));
    assert.equal(stderr, '');
    assert.equal(collect([4.3]).rows[0].sevenDayYield, 0.043);
});

test('filters numeric and string $1 prices in any position, nulls and zeros', () => {
    const { rows } = collect([1, '1.00', null, 0, '0', 4.25, 1.00001, 1]);
    assert.deepEqual(rows.map(row => row.sevenDayYield), [0.0425]);
    assert.equal(rows[0].asOfDate, '2026-10-06');
    assert.deepEqual(collect([1]).rows, []);
});

test('rejects NaN and infinite yields with diagnostics, retaining valid rows', () => {
    const { rows, stderr } = collect(['bad-data', 'NaN', 'Infinity', '-Infinity', 4.25]);
    assert.deepEqual(rows.map(row => row.sevenDayYield), [0.0425]);
    for (const [i, value] of ['bad-data', 'NaN', 'Infinity', '-Infinity'].entries()) {
        assert(stderr.includes(`Invalid yield for ticker FTEXX on 2026-10-0${i + 1}: ${value}`));
    }
});
