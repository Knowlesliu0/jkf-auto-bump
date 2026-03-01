const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testDirectLogin() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log(`[Test] Navigating directly to classic login page...`);
    await page.goto('https://www.jkforum.net/member.php?mod=logging&action=login', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(3000);

    const screenshotPath = path.join(__dirname, 'test_login_direct.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const htmlPath = path.join(__dirname, 'test_login_direct.html');
    fs.writeFileSync(htmlPath, await page.content());
    console.log(`[Test] Page URL is now: ${page.url()}`);

    console.log('[Test] Looking for username input...');
    try {
        await page.waitForSelector('input[name="username"], input[name="account"]', { state: 'visible', timeout: 5000 });
        console.log('[Test] FOUND username input!');
    } catch (e) {
        console.log('[Test] TIMEOUT waiting for username input!');
    }

    await browser.close();
}

testDirectLogin().then(() => console.log('Done'));
