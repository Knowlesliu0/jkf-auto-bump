const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
    const username = process.env.AIS_USERNAME;
    const password = process.env.AIS_PASSWORD;
    if (!username || !password) {
        console.error('請確認 .env 已設定帳密');
        process.exit(1);
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('登入 SAA 首頁...');
    await page.goto('https://www.sinjang.com.tw/Portal/');
    await page.fill('#ctl00_BodyContent_ACCOUNT', username);
    await page.fill('#ctl00_BodyContent_PASSWORD', password);

    await Promise.all([
        page.waitForNavigation(),
        page.click('#ctl00_BodyContent_LOGIN_BTN')
    ]);

    console.log('進入 AIS 查詢頁面...');
    await page.goto('https://www.sinjang.com.tw/Portal/BA0102_01.aspx');

    console.log('輸入查詢條件...');
    const today = new Date();
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 119);

    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    };

    await page.fill('#Q_BID_DATE_S', formatDate(pastDate));
    await page.fill('#Q_BID_DATE_E', formatDate(today));

    // Try to select BMW
    try {
        await page.selectOption('#Q_BRAND_ID', { label: 'BMW' });
        await page.waitForTimeout(1000);
        await page.selectOption('#Q_MODEL_ID', { label: '3 SERIES' });
    } catch (e) {
        console.log("選單選擇失敗", e);
    }

    console.log('點擊查詢並等待表格載入...');
    await page.click('#QUERY_BTN1');

    try {
        await page.waitForSelector('#DataGrid', { timeout: 30000 });
        console.log('表格載入成功！擷取結果清單...');

        // 解析 DataGrid 裡面的資料
        const records = await page.$$eval('#DataGrid tr', rows => {
            return rows.map(row => {
                const cols = Array.from(row.querySelectorAll('td, th')).map(col => col.innerText.trim().replace(/\s+/g, ' '));
                return cols;
            });
        });

        console.log(`共抓到 ${records.length} 列資料`);
        if (records.length > 1) {
            console.log('標題:', records[0]);
            console.log('第一筆:', records[1]);
        }

    } catch (e) {
        console.log('等待表格超時或失敗', e);
    }

    await browser.close();
})();
