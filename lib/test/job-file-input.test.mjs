import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));

function fixture(t, source) {
    const dir = mkdtempSync(join(tmpdir(), 'job-file-input-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const cwd = join(dir, source);
    mkdirSync(join(cwd, 'history'), { recursive: true });
    mkdirSync(join(dir, 'bin'));
    symlinkSync(join(root, 'lib'), join(dir, 'lib'));
    copyFileSync(join(root, 'bin/nodeJobUtils.sh'), join(dir, 'bin/nodeJobUtils.sh'));
    copyFileSync(join(root, 'bin/MM-update-common-job.sh'), join(dir, 'bin/MM-update-common-job.sh'));
    writeFileSync(join(dir, 'meta.common.sh'), `
cloudFlareHome="$PWD/../cloudflare"
protectOverwrite=true
export TMPDIR="$PWD/.."
`);
    for (const name of ['skipWeekends.sh', 'testDelays.sh']) {
        writeFileSync(join(dir, 'bin', name), '');
    }
    for (const name of ['ETF-facts-update-common-job.sh', 'ETF-distro-update-common-job.sh']) {
        writeFileSync(join(dir, 'bin', name), '#!/usr/bin/bash\nexit 0\n', { mode: 0o755 });
    }
    return cwd;
}

function run(cwd, script, env = {}) {
    return spawnSync('bash', [script], {
        cwd, env: { ...process.env, ...env }, encoding: 'utf8'
    });
}

for (const source of ['BOXX', 'USFR', 'ssga', 'bloxx', 'VanguardAdvisorsETF']) {
    test(`${source} job supplies facts to its yield parser by file`, t => {
        const cwd = fixture(t, source);
        const job = `job-${source}-update.sh`;
        copyFileSync(join(root, source, job), join(cwd, job));
        if (source === 'USFR') {
            symlinkSync(join(root, source, 'node-USFR-yield-update.js'),
                join(cwd, 'node-USFR-yield-update.js'));
        }
        if (source === 'ssga') writeFileSync(join(cwd, 'ssga-ETFs.csv'), 'BIL\n');
        if (source === 'VanguardAdvisorsETF') writeFileSync(join(cwd, 'dated-list.txt'), 'VSDB\n');
        const ticker = source === 'ssga' ? 'BIL' : source;
        writeFileSync(join(cwd, 'history', `${source}-facts-new.json`), JSON.stringify([{
            ticker, thirtyDayYield: 0.0425, source, asOfDate: '2026-10-09',
            factsOnly: 'not a rate attribute'
        }]));
        const result = run(cwd, job);
        assert.equal(result.status, 0, result.stderr);
        assert.doesNotMatch(result.stdout, /STEP FAILED/);
        const rows = JSON.parse(readFileSync(join(cwd, 'history', `${source}-rate-new.json`), 'utf8'));
        assert.equal(rows.length, 1);
        assert.equal(rows[0].ticker, ticker);
        assert.equal(rows[0].thirtyDayYield, 0.0425);
        assert.equal(rows[0].factsOnly, undefined);
    });
}

function cnbcFixture(t) {
    const cwd = fixture(t, 'cnbc');
    for (const name of ['job-cnbc-update.sh', 'test-cnbc-update.sh', 'cnbcCollectionScript.sh']) {
        copyFileSync(join(root, 'cnbc', name), join(cwd, name));
    }
    symlinkSync(join(root, 'cnbc/node-fetch-cnbc-yields.js'),
        join(cwd, 'node-fetch-cnbc-yields.js'));
    const mock = join(dirname(cwd), 'mock-fetch.mjs');
    writeFileSync(mock, `
globalThis.fetch = async url => {
    const { symbol } = JSON.parse(new URL(url).searchParams.get('variables'));
    if (!['CPFXX', 'FFTXX', 'FTEXX'].includes(symbol)) throw new Error('Unexpected symbol: ' + symbol);
    return { json: async () => ({ data: { chartData: {
        priceBars: [{ tradeTime: '20261009000000', close: 4.25 }]
    } } }) };
};
`);
    return { cwd, env: { NODE_OPTIONS: `--import=${pathToFileURL(mock).href}` } };
}

test('CNBC job collects every ticker from its file with no piped stdin', t => {
    const { cwd, env } = cnbcFixture(t);
    writeFileSync(join(cwd, 'cnbc-funds.csv'), 'CPFXX\nFFTXX\n');
    const result = run(cwd, 'job-cnbc-update.sh', env);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /STEP FAILED/);
    const rows = JSON.parse(readFileSync(join(cwd, 'history/cnbc-rate-new.json'), 'utf8'));
    assert.deepEqual(rows.map(row => row.ticker), ['CPFXX', 'FFTXX']);
    assert(rows.every(row => row.sevenDayYield === 0.0425));
});

test('CNBC single-ticker job supplies FTEXX by file', t => {
    const { cwd, env } = cnbcFixture(t);
    const result = run(cwd, 'test-cnbc-update.sh', env);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /STEP FAILED/);
    const rows = JSON.parse(readFileSync(join(cwd, 'history/cnbc-rate-new.json'), 'utf8'));
    assert.deepEqual(rows.map(row => row.ticker), ['FTEXX']);
});

test('CNBC collector rejects missing and empty ticker files', t => {
    const { cwd } = cnbcFixture(t);
    const empty = join(cwd, 'empty.csv');
    writeFileSync(empty, '');
    for (const args of [[], ['missing.csv'], [empty]]) {
        const result = spawnSync('bash', ['cnbcCollectionScript.sh', ...args], { cwd, encoding: 'utf8' });
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /Missing, unreadable or empty CNBC ticker-list file/);
    }
});
