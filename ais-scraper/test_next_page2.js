const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');

(async () => {
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
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
            await redCarLocator.click({ noWaitAfter: true });
            await page.waitForTimeout(5000); // Wait for the same page to navigate

            console.log("Clicking query...");
            await page.click('#QUERY_BTN1', { noWaitAfter: true }).catch(async () => {
                await page.click('input[value="查 詢"]', { noWaitAfter: true });
            });
            await page.waitForTimeout(8000); // Wait for query to complete and DataGrid to render

            const html = await page.content();
            fs.writeFileSync('datagrid_full.html', html, 'utf8');
            console.log("Dumped full html to datagrid_full.html");

            // Check for next page
            const count = await page.locator('a:text("＞")').count();
            console.log("Found ＞ tags:", count);
            const count2 = await page.locator('a:text("下一頁")').count();
            console.log("Found 下一頁 tags:", count2);

            // What is the text of all pagination links?
            const aTexts = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).map(a => a.innerText.trim()).filter(t => t.includes('>') || t.includes('＞') || t === '2');
            });
            console.log("Matching a tags texts:", aTexts);
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
