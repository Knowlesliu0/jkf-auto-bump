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

            await newPage.waitForTimeout(5000); // 讓頁面跑完

            const checkboxData = await newPage.evaluate(() => {
                const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]'));
                return cbs.map(c => {
                    let labelText = '';
                    const labelId = document.querySelector(`label[for="${c.id}"]`);
                    if (labelId) labelText = labelId.innerText.trim();
                    else {
                        // find nearest text
                        const nextNode = c.nextSibling;
                        if (nextNode && nextNode.nodeType === 3) labelText = nextNode.nodeValue.trim();
                        else if (nextNode && nextNode.nodeName === 'LABEL') labelText = nextNode.innerText.trim();
                    }
                    return { id: c.id, value: c.value, text: labelText };
                });
            });

            console.log("Checkboxes:");
            checkboxData.forEach(c => {
                if (c.text && c.text.length > 0) {
                    console.log(`[CB] ${c.id} => Text: ${c.text}, Value: ${c.value}`);
                }
            });

        }
    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
