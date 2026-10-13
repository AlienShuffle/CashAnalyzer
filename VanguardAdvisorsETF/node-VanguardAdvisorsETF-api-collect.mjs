import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseIoArgs, readText, writeJson, runMain } from '../lib/jsonIO.mjs';
import { collectFunds, validateHybridTickerCount } from './apiCollector.mjs';
import { guardedHybridRun } from './hybridRun.mjs';

runMain(async () => {
  const io = parseIoArgs();
  const hybridIndex = io.args.indexOf('--hybrid');
  const hybrid = hybridIndex !== -1;
  if (hybrid) io.args.splice(hybridIndex, 1);
  if (!io.input || io.output || io.args.length !== 2 || io.args[0] !== '--output-dir') {
    throw new Error('Usage: node node-VanguardAdvisorsETF-api-collect.mjs --input tickers.txt --output-dir comparison-directory [--hybrid]');
  }
  const outputDir = resolve(io.args[1]);
  const sourceDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  if (outputDir === sourceDir || ['history', 'downloads'].some(name => {
    const protectedDir = join(sourceDir, name);
    return outputDir === protectedDir || outputDir.startsWith(`${protectedDir}/`);
  })) throw new Error('API comparison output must not overwrite source history or downloads');
  const tickers = [...new Set((await readText(io.input)).split(/\r?\n/).map(line => line.trim().toUpperCase()).filter(Boolean))];
  if (!tickers.length) throw new Error('Empty Vanguard API ticker list');
  validateHybridTickerCount(tickers, hybrid);
  let result;
  const collect = async () => {
    let scraper;
    try {
      if (hybrid) {
        const { createDailyYieldScraper } = await import('./dailyYields.mjs');
        scraper = await createDailyYieldScraper();
      }
      return await collectFunds(tickers, {
        hybrid,
        scrapeDailyYields: scraper ? ticker => scraper.scrape(ticker) : undefined
      });
    } finally {
      if (scraper) await scraper.close();
    }
  };
  result = hybrid ? await guardedHybridRun(collect) : await collect();
  await mkdir(outputDir, { recursive: true });
  for (const [name, rows] of Object.entries(result)) {
    await writeJson(rows, join(outputDir, `${name}.json`));
  }
  console.error(`Collected ${result.facts.length} Vanguard funds into ${outputDir}; no history published`);
});
