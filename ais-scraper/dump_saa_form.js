const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://www.sinjang.com.tw/Portal/');
        await page.fill('#ctl00_BodyContent_ACCOUNT', process.env.AIS_USERNAME);
        await page.fill('#ctl00_BodyContent_PASSWORD', process.env.AIS_PASSWORD);
        await page.click('#ctl00_BodyContent_LOGIN_BTN');
        await page.waitForTimeout(3000);

        await page.goto('https://www.sinjang.com.tw/Portal/AUC2101_.aspx?EventPop=N', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const redCarLocator = page.locator('img[src*="ico_car"], img[src*="Icon_ca"], a[href*="CARDETAIL"]').first();
        if (await redCarLocator.count() > 0) {
            await redCarLocator.click();
        }

        await page.waitForTimeout(4000);

        const formHtml = await page.content();
        const fs = require('fs');
        fs.writeFileSync('saa_form_dump.txt', formHtml);

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
