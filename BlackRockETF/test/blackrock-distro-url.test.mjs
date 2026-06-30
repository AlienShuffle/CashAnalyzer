import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('uses the new fund-document endpoint for distro URLs', () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'blackrock-distro-'));
  const fundListPath = path.join(tempDir, 'tickers.txt');
  writeFileSync(fundListPath, 'SGOV\n');

  const payload = JSON.stringify({
    314116: {
      localExchangeTicker: 'SGOV',
      navAmountAsOf: { r: 20260626 },
      navAmount: { r: 100.01 },
      oneWeekSecYield: { r: 0.35 },
      thirtyDaySecYield: { r: 4.56 },
      twelveMonTrlYield: { r: 5.67 },
      accountType: 'Fund'
    }
  });

  try {
    const result = spawnSync(process.execPath, ['node-BlackRockETF-yield-update.js', fundListPath], {
      cwd: workspaceDir,
      input: payload,
      encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr);
    const rows = JSON.parse(result.stdout);
    assert.equal(rows.length, 1);
    assert.equal(
      rows[0].distroUrl,
      'https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v1/get-fund-document?appType=PRODUCT_PAGE&appSubType=ONE&targetSite=one&locale=en_US&portfolioId=314116&component=fundDownload&userType=individual'
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
