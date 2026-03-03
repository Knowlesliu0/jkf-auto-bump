const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://www.sinjang.com.tw/Portal/');
    const inputs = await page.$$eval('input', els => els.map(e => ({ id: e.id, name: e.name, type: e.type, value: e.value })));
    console.log(JSON.stringify(inputs, null, 2));
    await browser.close();
})();
