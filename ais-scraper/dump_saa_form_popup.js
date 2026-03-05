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
        await page.click('#ctl00_BodyContent_LOGIN_BTN');
        await page.waitForTimeout(3000);

        await page.goto('https://www.sinjang.com.tw/Portal/AUC2101_.aspx?EventPop=N', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        // Catch the new popup if there is one!
        const [newPage] = await Promise.all([
            context.waitForEvent('page').catch(() => page), // If it's a new tab it will be caught, otherwise fallback to page
            page.locator('img[src*="ico_car"], img[src*="Icon_ca"], a[href*="CARDETAIL"]').first().click()
        ]);

        await newPage.waitForTimeout(5000);
        await newPage.waitForSelector('#Q_BRAND_ID', { timeout: 10000 }); // Ensure it loaded

        const formHtml = await newPage.evaluate(() => {
            const container = document.querySelector('.Condition') || document.body;
            let result = '';

            // Text inputs
            container.querySelectorAll('input[type="text"]').forEach(input => {
                const tr = input.closest('td') || input.closest('tr') || document.body;
                result += `TextInput: ID=${input.id}, Name=${input.name}, Context=${tr.innerText.trim().replace(/\s+/g, ' ')}\n`;
            });
            // Selects
            container.querySelectorAll('select').forEach(sel => {
                const tr = sel.closest('td') || sel.closest('tr') || document.body;
                const opts = Array.from(sel.querySelectorAll('option')).map(o => o.innerText);
                result += `Select: ID=${sel.id}, Name=${sel.name}, Context=${tr.innerText.split('：')[0].trim().replace(/\s+/g, ' ')}, Options=[${opts.join(',')}]\n`;
            });

            return result;
        });

        console.log("=== Found Inputs ===");
        console.log(formHtml);
        fs.writeFileSync('saa_form_dropdowns.txt', formHtml);

    } catch (e) {
        console.error(e);
    } finally {
        if (browser) await browser.close();
    }
})();
