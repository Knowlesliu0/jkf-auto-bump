const { chromium } = require('playwright');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
require('dotenv').config();

// 讀取設定檔
const configPath = './config.json';
if (!fs.existsSync(configPath)) {
    console.error('找不到 config.json，請先建立並填寫搜尋條件。');
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 讀取帳密
const USERNAME = process.env.AIS_USERNAME;
const PASSWORD = process.env.AIS_PASSWORD;

if (!USERNAME || !PASSWORD || USERNAME === '你的帳號') {
    console.error('請先在 .env 檔案中填入真實的 AIS_USERNAME 和 AIS_PASSWORD！');
    process.exit(1);
}

(async () => {
    console.log('啟動瀏覽器...');
    // headless: false 可以看到實際操作過程，方便除錯抓 Selector
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 } // 讓視窗大一點，避免有些元素被遮擋
    });
    const page = await context.newPage();

    try {
        console.log('前往 AIS 網站...');
        // 根據你截圖的網址，這應該是該平台的入口
        const targetUrl = 'https://www.sinjang.com.tw/Portal/BA0102_01.aspx';
        await page.goto(targetUrl);

        console.log('等待頁面載入...');

        // --- 預留登入區塊 ---
        /*
        console.log('嘗試登入...');
        await page.fill('#LoginID', USERNAME); // TODO: 替換為實際 Account 輸入框的 Selector
        await page.fill('#PwdID', PASSWORD); // TODO: 替換為實際 Password 輸入框的 Selector
        await page.click('#LoginBtnID'); // TODO: 替換為點擊登入的 Selector
        await page.waitForNavigation();
        */

        console.log('請手動確認網頁結構，30秒後自動關閉...');
        // 先暫停 30 秒，讓你有時間把「登入」或「搜尋選單」的網頁結構給我看
        await page.waitForTimeout(30000);

        // --- 預留搜尋填表與抓資料區塊 ---
        /*
        console.log('填寫搜尋條件...');
        if (config.brand) {
            // await page.locator('...').selectOption(config.brand);
        }

        console.log('開始抓取資料...');
        const records = await page.$$eval('table.search-result tr', rows => {
            return rows.map(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length < 5) return null;
                return {
                    date: cols[0].innerText.trim(),
                    brand_model: cols[1].innerText.trim(),
                    type: cols[2].innerText.trim(),
                    year: cols[4].innerText.trim(),
                    price: cols[14].innerText.trim() // 假設第15欄是成交價 (依截圖推測)
                };
            }).filter(item => item !== null);
        });

        console.log(`找到 ${records.length} 筆資料，匯出中...`);

        const csvWriter = createCsvWriter({
            path: `ais_report_${Date.now()}.csv`,
            header: [
                { id: 'date', title: '拍賣日期' },
                { id: 'brand_model', title: '廠牌車型' },
                { id: 'type', title: '車輛型式' },
                { id: 'year', title: '出廠年月' },
                { id: 'price', title: '成交價' }
                // 後續把其他欄位都加上來
            ]
        });

        await csvWriter.writeRecords(records);
        console.log('資料匯出完成！');
        */

    } catch (error) {
        console.error('執行過程發生錯誤:', error);
    } finally {
        console.log('關閉瀏覽器...');
        await browser.close();
    }
})();
