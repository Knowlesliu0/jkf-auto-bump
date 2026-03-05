const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');

(async () => {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        console.log("Logging in...");
        await page.goto('https://www.sinjang.com.tw/Portal/');
        await page.fill('#ctl00_BodyContent_ACCOUNT', process.env.AIS_USERNAME);
        await page.fill('#ctl00_BodyContent_PASSWORD', process.env.AIS_PASSWORD);
        await page.click('#ctl00_BodyContent_LOGIN_BTN');
        await page.waitForTimeout(3000);

        console.log("Navigating to AUC2101_.aspx...");
        await page.goto('https://www.sinjang.com.tw/Portal/AUC2101_.aspx?EventPop=N', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);

        console.log("Dumping HTML...");
        const html = await page.content();
        fs.writeFileSync('auc2101_dump.html', html);

        const loc = page.locator('img[src*="ico_car"], img[src*="Icon_ca"], a[href*="CARDETAIL"]').first();
        const count = await loc.count();
        console.log("Matched locators count:", count);

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
