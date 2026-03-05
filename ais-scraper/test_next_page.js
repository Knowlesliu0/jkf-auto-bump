const { chromium } = require('playwright');
require('dotenv').config();

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
            const [newPage] = await Promise.all([
                context.waitForEvent('page').catch(() => page),
                redCarLocator.click({ noWaitAfter: true })
            ]);

            await newPage.waitForTimeout(8000); // Wait for DataGrid

            // Just try to find the next page button without querying (default shows all)
            const nextBtn = newPage.locator('a:text("＞")').first();
            const btnCount = await nextBtn.count();
            console.log(`Found "＞" buttons: ${btnCount}`);

            if (btnCount > 0) {
                console.log("Found Next Button HTML:", await nextBtn.evaluate(b => b.outerHTML));
                await nextBtn.click({ noWaitAfter: true });
                console.log("Clicked! Waiting 5s...");
                await newPage.waitForTimeout(5000);
                const page2Html = await newPage.evaluate(() => document.querySelector('.CurrentPage') ? document.querySelector('.CurrentPage').innerText : 'Unknown');
                console.log("Current Page after click:", page2Html);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
