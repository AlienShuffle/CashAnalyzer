import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSsgaFacts } from '../lib/ssgaFacts.mjs';

function overview() {
    return [
        { heading: 'Listing Information as of Oct 13 2026', rows: [] },
        { heading: 'Index Characteristics as of Oct 12 2026', rows: [['Average Coupon', '99%']] },
        {
            heading: 'Yields as of Oct 09 2026',
            rows: [
                ['30 Day SEC Yield (Unsubsidized)\nTooltip', '9.99%'],
                ['Fund Distribution Yield\nTooltip', '3.66%'],
                ['30 Day SEC Yield\n\ufeff30 Day SEC Yield\nTooltip', '3.68%']
            ]
        },
        {
            heading: 'Fund Characteristics as of Oct 12 2026',
            rows: [
                ['Yield to Maturity\nTooltip', '4.04%'],
                ['Option\u00a0Adjusted Duration\nTooltip', '0.13 years'],
                ['Average Yield To Worst\nTooltip', '4.03%'],
                ['Average Maturity in Years\nTooltip', '0.14'],
                ['Average Coupon\nTooltip', '0.00%']
            ]
        }
    ];
}

test('reads facts by section and label regardless of order, preserving zero values', () => {
    assert.deepEqual(extractSsgaFacts(overview(), 'BIL'), {
        thirtyDayYield: 0.0368,
        asOfDate: '2026-10-09',
        weightedAverageCoupon: 0,
        durationYears: 0.13,
        maturityYears: 0.14,
        yieldToWorst: 0.0403,
        yieldToMaturity: 0.0404,
        distributionYield: 0.0366
    });
});

test('missing or invalid required yield and date throw rather than emitting empty facts', () => {
    assert.throws(() => extractSsgaFacts([], 'BIL'), /No valid thirtyDayYield.*BIL/);
    const sections = overview();
    const yields = sections[2];
    yields.rows[2][1] = 'N/A';
    assert.throws(() => extractSsgaFacts(sections, 'BIL'), /No valid thirtyDayYield/);
    yields.rows[2][1] = '0.00%';
    assert.equal(extractSsgaFacts(sections, 'BIL').thirtyDayYield, 0);
    yields.heading = 'Yields as of invalid';
    assert.throws(() => extractSsgaFacts(sections, 'BIL'), /No valid yield asOfDate/);
});
