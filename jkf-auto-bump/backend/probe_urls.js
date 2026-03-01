const { chromium } = require('playwright');
const fs = require('fs');

async function probe() {
    const browser = await chromium.launch({ headless: true });

    for (const p of ['/login', '/user/login', '/member/login', '/logging']) {
        const url = 'https://jkforum.net' + p;
        const context = await browser.newContext();
        const page = await context.newPage();
        console.log(`Probing ${url}...`);
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
            await page.waitForTimeout(2000);
            const title = await page.title();
            console.log(`  -> Title: ${title}`);
            console.log(`  -> Final URL: ${page.url()}`);
        } catch (e) {
            console.log(`  -> Error: ${e.message}`);
        }
        await context.close();
    }

    await browser.close();
}

probe();
