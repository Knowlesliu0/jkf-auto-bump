const { chromium } = require('playwright');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

(async () => {
    console.log('啟動瀏覽器開始抓取廠牌車型...');
    const browser = await chromium.launch({ headless: true });
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

    // 取得所有廠牌 (過濾掉 空白與全部)
    const brands = await page.$$eval('#Q_BRAND_ID option', opts =>
        opts.filter(o => o.value !== '' && o.text !== '全部').map(o => o.text.trim())
    );

    const data = {};
    for (const brand of brands) {
        await page.selectOption('#Q_BRAND_ID', { label: brand });
        await page.waitForTimeout(500); // 等待車型 ajax
        const models = await page.$$eval('#Q_MODEL_ID option', opts =>
            opts.filter(o => o.value !== '' && o.text !== '全部').map(o => o.text.trim())
        );
        data[brand] = models;
        console.log(`已抓取廠牌 ${brand}: 找到 ${models.length} 個車型`);
    }

    const filepath = path.join(__dirname, 'public', 'brands_models.json');
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`所有廠牌車型已儲存至 ${filepath}`);
    await browser.close();
})();
