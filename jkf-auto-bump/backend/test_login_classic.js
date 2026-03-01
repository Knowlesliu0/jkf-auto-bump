const { chromium } = require('playwright');
const fs = require('fs');

async function testClassicLogin() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`[Test] Navigating to classic URL...`);
    await page.goto('https://www.jkforum.net/thread-20554874-1-1.html', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(3000);
    console.log(`[Test] Page URL is now: ${page.url()}`);
    console.log(`[Test] Page Title: ${await page.title()}`);

    const htmlPath = require('path').join(__dirname, 'test_login_classic.html');
    fs.writeFileSync(htmlPath, await page.content());

    await browser.close();
}

testClassicLogin().then(() => console.log('Done'));
