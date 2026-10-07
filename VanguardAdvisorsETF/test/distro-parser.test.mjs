import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = 'node-VanguardAdvisorsETF-distro-update.js';

function runParser(input, ticker = 'VBIL') {
  return spawnSync(process.execPath, [script, ticker], {
    cwd: workspaceDir,
    input,
    encoding: 'utf8'
  });
}

// Shape returned by /investments/products/api/funds/<portId>/pricing/distributions
const apiJson = JSON.stringify([
  { typeCode: 'INC', amount: 0.2177, payableDate: '2026-10-05', exDividendDate: '2026-10-01', recordDate: '2026-10-01' },
  { typeCode: 'CGST', amount: 0.01, payableDate: '2026-09-03', exDividendDate: '2026-09-01', recordDate: '2026-09-01' },
  { typeCode: 'CGLT', amount: 0.02, payableDate: '2026-09-03', exDividendDate: '2026-09-01', recordDate: '2026-09-01' },
  { typeCode: 'INC', amount: 0.2223, payableDate: '2026-09-03', exDividendDate: '2026-09-01', recordDate: '2026-09-01' }
]);

// Shape produced by the "Export distribution data" button, including its five header rows.
const exportCsv = [
  '0-3 Month Treasury Bill ETF (VBIL)',
  '',
  '"Note: Microsoft Excel opens the downloaded file with $/share column in currency format."',
  '',
  'TYPE,$/SHARE,PAYABLE DATE,RECORD DATE,EX-DIVIDEND DATE,DISTRIBUTION YIELD,DISTRIBUTION YIELD AS OF',
  'Income,$0.217700,10/05/2026,10/01/2026,10/01/2026,-,10/01/2026',
  'Short-term Capital Gain,$0.010000,09/03/2026,09/01/2026,09/01/2026,-,09/01/2026',
  'Long-term Capital Gain,$0.020000,09/03/2026,09/01/2026,09/01/2026,-,09/01/2026',
  'Income,$0.222300,09/03/2026,09/01/2026,09/01/2026,3.70%,09/01/2026'
].join('\n');

test('parses the distributions API JSON shape', () => {
  const result = runParser(apiJson);
  assert.equal(result.status, 0, result.stderr);

  const rows = JSON.parse(result.stdout);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].recordDate, '2026-10-01');
  assert.equal(rows[0].exDividendDate, '2026-10-01');
  assert.equal(rows[0].payableDate, '2026-10-05');
  assert.equal(rows[0].ordinaryIncome, 0.2177);
  assert.equal(rows[0].totalDistribution, 0.2177);

  // CGST/CGLT type codes must map onto the capital gain buckets and roll into the total.
  assert.equal(rows[1].stcg, 0.01);
  assert.equal(rows[1].ltcg, 0.02);
  assert.equal(rows[1].ordinaryIncome, 0.2223);
  assert.equal(rows[1].totalDistribution, 0.2523);
});

test('parses the CSV export shape identically to the API JSON', () => {
  const fromCsv = runParser(exportCsv);
  const fromJson = runParser(apiJson);
  assert.equal(fromCsv.status, 0, fromCsv.stderr);
  assert.equal(fromJson.status, 0, fromJson.stderr);

  const strip = out => JSON.parse(out).map(({ timestamp, ...rest }) => rest);
  assert.deepEqual(strip(fromCsv.stdout), strip(fromJson.stdout));
});

test('fails loudly when handed the wrong CSV instead of emitting an empty array', () => {
  // This is the weighted-exposures file that a mis-detected download used to leave behind.
  const issuerTypeCsv = [
    'Weighted exposures',
    '',
    'Issuer',
    '',
    '0-3 Month Treasury Bill ETF (VBIL)',
    '',
    'as of 08/31/2026',
    '',
    'Issuer,% of fund',
    'Treasury / Agency,103.20%'
  ].join('\n');

  const result = runParser(issuerTypeCsv);
  assert.notEqual(result.status, 0, 'wrong content must not exit successfully');
  assert.equal(result.stdout.trim(), '');
  assert.match(result.stderr, /No distributions parsed/);
});

test('fails loudly on empty input', () => {
  const result = runParser('');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No distribution content supplied/);
});
