import puppeteer from 'puppeteer';
import { parseFundamentals } from './factsParsing.mjs';

export function parseDailyYields(text) {
  if (!/\bDaily\b/.test(text)) throw new Error('Daily fundamentals tab not found');
  const match = text.match(/as of\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!match) throw new Error('Daily fundamentals date not found');
  const asOfDate = `${match[3]}-${match[1]}-${match[2]}`;
  if (!Number.isFinite(Date.parse(asOfDate)) || new Date(asOfDate).toISOString().slice(0, 10) !== asOfDate) {
    throw new Error(`Invalid daily fundamentals date: ${asOfDate}`);
  }
  const parsed = parseFundamentals(text);
  const values = {};
  for (const field of ['yieldToMaturity', 'yieldToWorst']) {
    if (parsed.values[field] !== undefined) values[field] = parsed.values[field];
  }
  return { asOfDate, values, text };
}

export async function createDailyYieldScraper() {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  return {
    close: () => browser.close(),
    async scrape(ticker) {
      const page = await browser.newPage();
      try {
        await page.goto(`https://advisors.vanguard.com/investments/products/${ticker.toLowerCase()}`, {
          waitUntil: 'networkidle2', timeout: 45000
        });
        await page.waitForSelector('[data-rpa-tag-id="hero-ff-secYield-pct"]', { timeout: 15000 });
        const dailyTab = await page.$('section.fundamentals-data [role="tab"][aria-label="Daily"]');
        if (dailyTab) {
          await dailyTab.click();
          await page.waitForFunction(() => {
            const section = document.querySelector('section.fundamentals-data');
            const tab = section?.querySelector('[role="tab"][aria-label="Daily"]');
            const panel = tab && document.getElementById(tab.getAttribute('aria-controls'));
            return /as of\s+\d{2}\/\d{2}\/\d{4}/i.test(section?.innerText || '') &&
              tab?.getAttribute('aria-selected') === 'true' && Boolean(panel?.innerText.trim());
          }, { timeout: 15000 });
        }
        const panel = await page.evaluate(() => {
          const section = document.querySelector('section.fundamentals-data');
          if (!section) return null;
          const tab = section.querySelector('[role="tab"][aria-label="Daily"]');
          if (tab?.getAttribute('aria-selected') !== 'true') throw new Error('Daily fundamentals tab is not selected');
          const panel = document.getElementById(tab.getAttribute('aria-controls'));
          if (!panel || !panel.innerText.trim()) throw new Error('Daily fundamentals panel is empty');
          const date = section.querySelector('h3')?.parentElement?.innerText || '';
          return `${date}\nDaily\n${panel.innerText}`;
        });
        if (panel === null) return { values: {}, asOfDate: null, text: '', reason: 'Daily fundamentals panel not available' };
        return parseDailyYields(panel);
      } finally {
        await page.close();
      }
    }
  };
}
