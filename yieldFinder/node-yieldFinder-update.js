#!/usr/bin/env node

import puppeteer from 'puppeteer';

const url = 'https://yieldFinder.app/json';

async function run() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();
        const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        if (!response || !response.ok()) {
            throw new Error(`Failed to load ${url}: ${response ? response.status() : 'no response'}`);
        }

        const jsonText = await response.text();
        const json = JSON.parse(jsonText);
        const data = json.data;
        const timestamp = new Date();
        // convert the data into my facts file format and dump on stdout.
        let resp = [];
        for (let i = 0; i < data.length; i++) {
            const acct = data[i];
            if (acct.account_type == 'Savings Account') {
                const row = {
                    "accountType": acct.account_name,
                    "apy": (acct.value / 100).toFixed(4) * 1,
                    "asOfDate": acct.date,
                    "source": 'node-yieldFinder-json-update.js',
                    "timestamp": timestamp,
                };
                resp.push(row);
            }
        }
        console.log(JSON.stringify(resp));
    } finally {
        await browser.close();
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
