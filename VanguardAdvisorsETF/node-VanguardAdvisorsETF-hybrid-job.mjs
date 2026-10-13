import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readText, writeJson, runMain } from '../lib/jsonIO.mjs';
import { collectFunds } from './apiCollector.mjs';
import { createDailyYieldScraper } from './dailyYields.mjs';
import { guardedHybridRun, selectHybridTickers } from './hybridRun.mjs';

runMain(async () => {
  if (process.argv.length !== 2) throw new Error('Hybrid job collector accepts no arguments');
  await guardedHybridRun(async () => {
    const tickers = [...new Set((await readText('VanguardETF-funds.txt')).split(/\r?\n/).map(t => t.trim().toUpperCase()).filter(Boolean))];
    if (!tickers.length) throw new Error('Empty Vanguard scheduled ticker list');
    // Rotate attempted funds even if the provider rejects a batch.
    const selected = await selectHybridTickers(tickers);
    const scraper = await createDailyYieldScraper();
    let result;
    try {
      result = await collectFunds(selected, { hybrid: true, scrapeDailyYields: ticker => scraper.scrape(ticker) });
    } finally {
      await scraper.close();
    }
    const output = 'history/hybrid-batch';
    await mkdir(output, { recursive: true });
    for (const [name, rows] of Object.entries(result)) await writeJson(rows, join(output, `${name}.json`));
    for (const ticker of selected) {
      await mkdir(`downloads/${ticker}`, { recursive: true });
      await writeJson(result.raw[ticker].distributions, `downloads/${ticker}/${ticker}-distributions.json`);
    }
    await writeJson(result.facts, 'history/VanguardAdvisorsETF-facts-new.json');
    console.error(`Vanguard hybrid collected ${selected.length} funds: ${selected.join(', ')}`);
  });
});
