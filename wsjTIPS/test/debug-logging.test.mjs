import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { duGetISOString } from '../../lib/dateUtils.mjs';

async function runCollector(file, debug, fail = false) {
    const stdout = [], stderr = [];
    let closed = false, navigations = 0;
    const headers = ['Maturity', 'Coupon', 'Bid', 'Asked', 'Chg', 'Yield'];
    const values = ['10/15/2030', '4.25', '99.16', '100.08', 'unch.', '4.50'];
    if (file.includes('TIPS')) {
        headers.push('Accrued Principal');
        values.push('1012.34');
    }
    const cells = items => items.map(innerHTML => ({ innerHTML }));
    const rows = [
        { $$: async () => cells(headers) },
        { $$: async () => cells(values) }
    ];
    const page = {
        setDefaultNavigationTimeout: async () => {},
        goto: async () => {
            navigations++;
            if (fail) throw new Error('simulated WSJ navigation failure');
        },
        waitForSelector: async selector => selector.startsWith('span') ?
            { innerHTML: '2026-10-13T10:00:00-04:00' } :
            { $$: async () => rows },
        evaluate: async (fn, input) => fn(input)
    };
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
        .replace(/^import .*;\s*$/gm, '');
    await vm.runInNewContext(source, {
        duGetISOString,
        puppeteer: { launch: async () => ({
            newPage: async () => page,
            close: async () => { closed = true; }
        }) },
        process: { env: debug === undefined ? {} : { DEBUG: debug } },
        console: {
            log: value => stdout.push(value),
            error: value => stderr.push(String(value))
        },
        setTimeout: fn => { fn(); },
        Date
    }, { filename: file });
    return { stdout, stderr, closed, navigations };
}

for (const file of ['node-wsjTIPS-update.js', 'node-wsjTreasuryBonds-update.js']) {
    test(`${file}: DEBUG controls routine stderr without changing quote output`, async () => {
        const quiet = await runCollector(file);
        const disabled = await runCollector(file, 'false');
        const verbose = await runCollector(file, 'true');
        assert.deepEqual(quiet.stderr, []);
        assert.deepEqual(disabled.stderr, []);
        assert.deepEqual(verbose.stdout, quiet.stdout);
        assert.deepEqual(disabled.stdout, quiet.stdout);
        assert.ok(verbose.stderr.some(line => /Starting wsj/.test(line)));
        assert.ok(verbose.stderr.some(line => /Found 2 table rows/.test(line)));
        const [quote] = JSON.parse(quiet.stdout[0]);
        assert.equal(quote.coupon, 0.0425);
        assert.equal(quote.yield, 0.045);
        assert.equal(quote.bid, 99.5);
        assert.equal(quote.asked, 100.25);
        assert.equal(quote.chg, 0);
        assert.equal(quote.key, '2030-10-15-0.04250');
        assert.ok(quiet.closed && disabled.closed && verbose.closed);
    });

    test(`${file}: failures remain visible with DEBUG unset`, async () => {
        const result = await runCollector(file, undefined, true);
        assert.deepEqual(result.stdout, []);
        assert.equal(result.stderr.length, 1);
        assert.match(result.stderr[0], /simulated WSJ navigation failure/);
        assert.equal(result.navigations, 3);
        assert.ok(result.closed);
    });
}
