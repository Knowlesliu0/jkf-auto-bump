const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://www.sinjang.com.tw/Portal/');
    await page.fill('#ctl00_BodyContent_ACCOUNT', process.env.AIS_USERNAME);
    await page.fill('#ctl00_BodyContent_PASSWORD', process.env.AIS_PASSWORD);
    await Promise.all([
        page.waitForNavigation(),
        page.click('#ctl00_BodyContent_LOGIN_BTN')
    ]);

    await page.goto('https://www.sinjang.com.tw/Portal/BA0102_01.aspx');
    // 找 BENZ C CLASS
    await page.selectOption('#Q_BRAND_ID', { label: 'BENZ' });
    await page.waitForTimeout(1000);
    await page.selectOption('#Q_MODEL_ID', { label: 'C CLASS'.trim() });

    await page.click('#QUERY_BTN1');
    await page.waitForSelector('#DataGrid');

    const html = await page.$eval('#DataGrid', el => el.outerHTML);
    fs.writeFileSync('datagrid_sample.html', html, 'utf8');

    // extract head to find script definitions
    const headHtml = await page.$eval('head', el => el.outerHTML);
    fs.writeFileSync('head_sample.html', headHtml, 'utf8');

    await browser.close();
})();
