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
        if (source === 'VanguardAdvisorsETF') writeFileSync(join(cwd, 'node-VanguardAdvisorsETF-hybrid-job.mjs'), '');
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

test('BlackRock ETF job passes ticker URLs to the facts job by file', t => {
    const cwd = fixture(t, 'BlackRockETF');
    copyFileSync(join(root, 'BlackRockETF/job-BlackRockETF-update.sh'),
        join(cwd, 'job-BlackRockETF-update.sh'));
    writeFileSync(join(cwd, 'history/BlackRockETF-rate-new.json'), JSON.stringify([
        { ticker: 'STIP', baseUrl: 'https://blackrock.com/us/individual/products/239450/', asOfDate: '2026-10-12', thirtyDayYield: 0.03299 },
        { ticker: 'TLT', baseUrl: 'https://blackrock.com/us/individual/products/239454/', asOfDate: '2026-10-12', thirtyDayYield: 0.05545 }
    ]));
    writeFileSync(join(dirname(cwd), 'bin/MM-update-common-job.sh'), '#!/usr/bin/bash\nexit 0\n');
    writeFileSync(join(dirname(cwd), 'bin/ETF-facts-update-common-job.sh'), `#!/usr/bin/bash
[ "$1" = "--inputFile" ] || exit 2
[ -s "$2" ] || exit 3
cp "$2" received-facts.csv
`);
    const result = run(cwd, 'job-BlackRockETF-update.sh');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(cwd, 'received-facts.csv'), 'utf8'),
        'STIP,https://blackrock.com/us/individual/products/239450/,2026-10-12,0.03299\n' +
        'TLT,https://blackrock.com/us/individual/products/239454/,2026-10-12,0.05545\n');

    for (const input of ['[]', 'invalid JSON']) {
        rmSync(join(cwd, 'received-facts.csv'));
        writeFileSync(join(cwd, 'history/BlackRockETF-rate-new.json'), input);
        const failed = run(cwd, 'job-BlackRockETF-update.sh');
        assert.equal(failed.status, 1);
        assert.match(failed.stderr, /BlackRockETF.*facts input/);
        assert.throws(() => readFileSync(join(cwd, 'received-facts.csv')), /ENOENT/);
        writeFileSync(join(cwd, 'received-facts.csv'), '');
    }
});

test('shared ETF facts job supplies file input and preserves prior facts on scraper failure', t => {
    const cwd = fixture(t, 'BlackRockETF');
    copyFileSync(join(root, 'bin/ETF-facts-update-common-job.sh'),
        join(dirname(cwd), 'bin/ETF-facts-update-common-job.sh'));
    const input = 'STIP,https://blackrock.com/us/individual/products/239450/,2026-10-12,0.03299\n';
    writeFileSync(join(cwd, 'tickerAndUrls.csv'), input);
    const prior = '[{"ticker":"STIP","thirtyDayYield":0.03}]';
    writeFileSync(join(cwd, 'history/BlackRockETF-facts-new.json'), prior);
    writeFileSync(join(cwd, 'node-BlackRockETF-facts-update.js'), `
const fs = require('node:fs');
fs.writeFileSync('received-facts.csv', fs.readFileSync(0, 'utf8'));
console.error('mock scraper failure');
process.exitCode = 7;
`);
    const result = spawnSync('bash', ['../bin/ETF-facts-update-common-job.sh', '--inputFile', 'tickerAndUrls.csv'], {
        cwd, env: { ...process.env, errFile: join(cwd, 'scraper-stderr.txt') }, encoding: 'utf8'
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Facts processScript failed \(status 7 0\)/, result.stderr);
    assert.equal(readFileSync(join(cwd, 'received-facts.csv'), 'utf8'), input);
    assert.match(readFileSync(join(cwd, 'scraper-stderr.txt'), 'utf8'), /mock scraper failure/);
    assert.equal(readFileSync(join(cwd, 'history/BlackRockETF-facts-new.json'), 'utf8'), prior);
});

test('Vanguard hybrid job publishes only the collected batch from files and stops on collector failure', t => {
        const cwd = fixture(t, 'VanguardAdvisorsETF');
        copyFileSync(join(root, 'VanguardAdvisorsETF/job-VanguardAdvisorsETF-update.sh'),
            join(cwd, 'job-VanguardAdvisorsETF-update.sh'));
        writeFileSync(join(cwd, 'node-VanguardAdvisorsETF-hybrid-job.mjs'), `
    import {mkdirSync, writeFileSync} from 'node:fs';
    if (process.env.VANGUARD_TEST_FAIL) throw new Error('provider cooldown');
    const tickers = ['BND','VBIL','VTEB','VTIP'];
    for (const ticker of tickers) {
        mkdirSync('downloads/'+ticker, {recursive:true});
        writeFileSync('downloads/'+ticker+'/'+ticker+'-distributions.json', '[{"amount":0.1}]');
    }
    writeFileSync('history/VanguardAdvisorsETF-facts-new.json', JSON.stringify(tickers.map(ticker => ({ticker,thirtyDayYield:0.04}))));
    `);
        for (const name of ['ETF-facts-update-common-job.sh', 'MM-update-common-job.sh']) {
            writeFileSync(join(dirname(cwd), 'bin', name), `#!/usr/bin/bash
    printf '%s\\n' "$*" >> publish-calls.txt
    `, { mode: 0o755 });
        }
        writeFileSync(join(dirname(cwd), 'bin/ETF-distro-update-common-job.sh'), `#!/usr/bin/bash
    IFS= read -r ticker
    echo "distro:$ticker" >> publish-calls.txt
    `, { mode: 0o755 });
        const result = run(cwd, 'job-VanguardAdvisorsETF-update.sh');
        assert.equal(result.status, 0, result.stderr);
        const calls = readFileSync(join(cwd, 'publish-calls.txt'), 'utf8');
        assert.match(calls, /--injectProcessedJson history\/VanguardAdvisorsETF-facts-new.json/);
        assert.match(calls, /--inputFile history\/VanguardAdvisorsETF-facts-new.json/);
        assert.deepEqual(calls.split('\n').filter(line => line.startsWith('distro:')),
            ['distro:BND', 'distro:VBIL', 'distro:VTEB', 'distro:VTIP']);
        rmSync(join(cwd, 'publish-calls.txt'));
        const failed = run(cwd, 'job-VanguardAdvisorsETF-update.sh', { VANGUARD_TEST_FAIL: '1' });
        assert.notEqual(failed.status, 0);
        assert.match(failed.stderr, /provider cooldown/);
        assert.throws(() => readFileSync(join(cwd, 'publish-calls.txt')), /ENOENT/);
});
