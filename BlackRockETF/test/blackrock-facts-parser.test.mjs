import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFundFactsFromText } from '../lib/blackrockFactsParser.mjs';

test('extracts key fund facts from the current BlackRock page text layout', () => {
  const pageText = `
    iShares 0-5 Year TIPS Bond ETF
    NAV as of Jul 08, 2026
    $101.29
    30 Day SEC Yield as of Jul 08, 2026
    11.60%
    12m Trailing Yield as of Jul 08, 2026
    4.91%
    Expense Ratio: Fees as stated in the prospectus
    0.03%
    Weighted Avg Coupon 1.07 as of Jul 08, 2026
    Effective Duration 2.31 yrs as of Jul 08, 2026
    Weighted Avg YTM 4.27% as of Jul 08, 2026
    Weighted Avg Maturity 2.40 yrs as of Jul 08, 2026
  `;

  const facts = extractFundFactsFromText(pageText, { ticker: 'STIP', pageTitle: 'iShares 0-5 Year TIPS Bond ETF | STIP' });

  assert.equal(facts.fundName, 'iShares 0-5 Year TIPS Bond ETF');
  assert.equal(facts.nav, 101.29);
  assert.equal(facts.expenseRatio, 0.0003);
  assert.equal(facts.weightedAverageCoupon, 1.07);
  assert.equal(facts.durationYears, 2.31);
  assert.equal(facts.yieldToWorst, 0.0427);
  assert.equal(facts.twelveMonTrlYield, 0.0491);
  assert.equal(facts.maturityYears, 2.4);
});
