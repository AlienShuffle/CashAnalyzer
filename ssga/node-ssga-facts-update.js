import { readText } from "../lib/jsonIO.mjs";
import puppeteer from "puppeteer";
import { readFileSync } from 'fs';
import dynamicSort from '../lib/dynamicSort.mjs';
import { extractSsgaFacts } from './lib/ssgaFacts.mjs';

if (process.argv.length != 3) throw new Error('missing argv[2] tickerlist.csv');
const tickerList = readFileSync(process.argv[2], 'utf-8').split(/\r?\n/).map(ticker => ticker.trim()).filter(Boolean);
const json = JSON.parse(await readText());
const funds = json.data.funds.etfs.datas.filter(fund => tickerList.includes(fund.fundTicker));
if (funds.length === 0) throw new Error('No requested SSGA funds found in collector data');

const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

const results = [];
try {
    for (const fund of funds) {
        const ticker = fund.fundTicker;
        if (!fund.fundUri) throw new Error(`No fund URL found for ticker '${ticker}'`);
        console.error(`Scraping fund: ${ticker}`);
        const page = await browser.newPage();
        try {
            await page.goto(`https://www.ssga.com/${fund.fundUri}`, { waitUntil: "networkidle2" });
            await page.waitForSelector('#overview section h2');
            const overview = await page.evaluate(() => ({
                fundName: document.querySelector('span.fund-header__name')?.innerText.trim(),
                sections: [...document.querySelectorAll('#overview section')].map(section => ({
                    heading: section.querySelector('h2')?.innerText || '',
                    rows: [...section.querySelectorAll('tr')].map(row =>
                        [...row.querySelectorAll('th,td')].map(cell => cell.innerText)
                    ).filter(row => row.length >= 2)
                }))
            }));
            const rowData = {
                ticker,
                source: "ssga",
                timestamp: new Date(),
                ...extractSsgaFacts(overview.sections, ticker)
            };
            if (fund.nav?.[1] !== undefined) rowData.nav = fund.nav[1];
            if (fund.aum?.[1] !== undefined) {
                const unit = fund.aum[0].toLowerCase();
                rowData.aum = fund.aum[1] * (unit.includes("b") ? 1e9 : unit.includes("m") ? 1e6 : 1);
            }
            if (fund.ter?.[1] !== undefined) rowData.expenseRatio = Number((fund.ter[1] / 100).toFixed(6));
            if (overview.fundName) {
                rowData.fundName = overview.fundName;
            } else {
                console.error(`No fundName found for ticker '${ticker}'`);
            }
            results.push(rowData);
            await new Promise(resolve => setTimeout(resolve, 2000));
        } finally {
            await page.close();
        }
        if (results.length > 10) break;
    }
    console.log(JSON.stringify(results.sort(dynamicSort('ticker'))));
} finally {
    await browser.close();
}
