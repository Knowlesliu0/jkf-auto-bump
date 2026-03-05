const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');

(async () => {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://www.sinjang.com.tw/Portal/');
        await page.fill('#ctl00_BodyContent_ACCOUNT', process.env.AIS_USERNAME);
        await page.fill('#ctl00_BodyContent_PASSWORD', process.env.AIS_PASSWORD);
        await page.click('#ctl00_BodyContent_LOGIN_BTN', { noWaitAfter: true });
        await page.waitForTimeout(3000);

        await page.goto('https://www.sinjang.com.tw/Portal/AUC2101_.aspx?EventPop=N', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        const redCarLocator = page.locator('img[src*="ico_car"], img[src*="Icon_ca"], img[src*="icon8"], img[onclick*="CARDETAIL"], img[onclick*="TICARDETAIL"], a[href*="CARDETAIL"]').first();
        if (await redCarLocator.count() > 0) {
            const [newPage] = await Promise.all([
                context.waitForEvent('page').catch(() => page),
                redCarLocator.click({ noWaitAfter: true })
            ]);

            await newPage.waitForTimeout(5000); // just wait for it to load default data

            const html = await newPage.content();
            fs.writeFileSync('pagination_dump.html', html, 'utf8');
            console.log("Dumped newPage html to pagination_dump.html");
        } else {
            console.log("No red car found.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
