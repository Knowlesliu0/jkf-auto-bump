const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 確保有資料夾放報告
if (!fs.existsSync(path.join(__dirname, 'reports'))) {
    fs.mkdirSync(path.join(__dirname, 'reports'));
}

// 取得目前的帳號密碼，方便網頁自動填寫
app.get('/api/config', (req, res) => {
    res.json({
        username: process.env.AIS_USERNAME || '',
        password: process.env.AIS_PASSWORD || ''
    });
});

// Removed Google GenAI
app.post('/api/scrape', async (req, res) => {
    let { username, password, need, brand, model, year, budgetMin, budgetMax } = req.body;
    let productionPeriod = '';

    if (!username || !password) {
        return res.status(400).json({ success: false, message: '請輸入帳號密碼' });
    }

    // 更新 .env 檔案以記憶帳密與金鑰
    let currentApiKey = process.env.DEEPSEEK_API_KEY || '';
    try {
        const currentEnv = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
        const match = currentEnv.match(/DEEPSEEK_API_KEY=(.*)/);
        if (match) currentApiKey = match[1].trim();
    } catch (e) { }
    const envContent = `AIS_USERNAME=${username}\nAIS_PASSWORD=${password}\nDEEPSEEK_API_KEY=${currentApiKey}`;
    fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf8');

    console.log(`收到查詢請求: 需求="${need}"`);

    // 如果有輸入口語需求，利用 Gemini API 分析出廠牌跟車型
    if (need && need.trim() !== '') {
        try {
            console.log('正在分析口語需求...');
            const prompt = `根據使用者的口語需求「${need}」，請幫我分析出他想找的二手車廠牌、車型、生產年份區間、以及排氣量區間。
            
請務必只回傳一段 JSON 格式字串，不要包含其他文字或 Markdown 標記，格式如下：
{
  "brand": "廠牌名稱(例如 BWM, BENZ, TOYOTA，如果沒有提到請填空字串)",
  "model": "車型(例如 3 SERIES, C CLASS，如果無法確認請填空字串，請注意 BMW 車型通常是 X SERIES，BENZ 車系請填 C CLASS 等)",
  "yearStart": "出廠年份起(如果知道該代號的生產起頭年份，例如 E92 是 2006，請填 2006；如果沒有請填空字串)",
  "yearEnd": "出廠年份迄(如果知道該代號的停產年份，例如 E92 是 2013，請填 2013；如果使用者有指定單一特定年份，起訖填一樣；如果沒有請填空字串)",
  "ccStart": "排氣量起(單位為 cc，例如 335i 大約是 2979cc，如果是 2.0L 就是 1998cc 等，若不確定請填空。數字就好，例如 2900)",
  "ccEnd": "排氣量迄(單位為 cc，可稍微抓個範圍，例如 335i 可以填 3000。數字就好，例如 3000。若不確定請填空)",
  "budgetMin": "預算下限(如果有提到區間起點，只取出數字部分，單位為萬元，例如 50，沒有請填空字串)",
  "budgetMax": "預算上限(如果有提到區間迄點，或者最高預算，只取出數字部分，單位為萬元，例如 80，沒有請填空字串)",
  "productionPeriod": "該車款出廠期間(請務必同時包含年份與「月份」，例如：2017年6月~2022年8月。請不要只回答年份，若只知道年份也請查證該代號通常的發表與停產月份，若完全不知道請填空字串)"
}

對於「E92 335i」這種需求：
E92 是 BMW 3系列的代號，生產年份大約是 2006 到 2013。
335i 也是 3 系列的車款，排氣量大約是 3000cc (2979cc)。
所以你的分析結果 brand 應該是 "BMW"，model 應該是 "3 SERIES"
只要是 BMW 318i, 320i, 328i, 335i, 340i, E90, E92, F30, G20 等，model 都是 "3 SERIES"
BENZ C300, C250, W204, W205 等，model 是 "C CLASS"`;

            const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: '你是一個專業的二手車資料萃取助理，只能回傳精準的 JSON 格式字串。' },
                        { role: 'user', content: prompt }
                    ],
                    stream: false
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`DeepSeek API 錯誤: ${response.status} - ${errorData}`);
            }

            const aiResponse = await response.json();
            const text = aiResponse.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(text);
            console.log('需求分析結果：', parsed);

            if (parsed.brand) brand = parsed.brand;
            if (parsed.model) model = parsed.model;
            // 優先使用 AI 推理出來的年份如果使用者沒填
            if (!year && parsed.yearStart) req.body.yearStart = parsed.yearStart;
            if (!year && parsed.yearEnd) req.body.yearEnd = parsed.yearEnd;
            if (parsed.ccStart) req.body.ccStart = parsed.ccStart;
            if (parsed.ccEnd) req.body.ccEnd = parsed.ccEnd;
            if (parsed.budgetMin) budgetMin = parsed.budgetMin;
            if (parsed.budgetMax) budgetMax = parsed.budgetMax;
            if (parsed.productionPeriod) productionPeriod = parsed.productionPeriod;
        } catch (e) {
            console.error('分析口語需求失敗:', e);
            // 如果使用者只填口語需求，且 AI 分析失敗，就中斷查詢避免跑進全域搜尋
            if (!brand && !model) {
                return res.json({ success: false, message: 'AI 分析需求失敗 (可能遭遇免費額度限制)，請直接改用上方欄位手動輸入查詢條件' });
            }
        }
    }

    let browser;
    try {
        browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();

        console.log('正在前往 SAA 首頁登入頁面...');
        await page.goto('https://www.sinjang.com.tw/Portal/');

        console.log('輸入帳號密碼...');
        await page.fill('#ctl00_BodyContent_ACCOUNT', username);
        await page.fill('#ctl00_BodyContent_PASSWORD', password);

        console.log('點擊登入按鈕並等待跳轉...');
        await Promise.all([
            page.waitForNavigation(), // 等待頁面跳轉
            page.click('#ctl00_BodyContent_LOGIN_BTN')
        ]);

        // 進入 AIS 查詢頁面
        console.log('登入成功！正在前往 AIS 成交行情頁面...');
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

        if (brand) {
            try {
                await page.selectOption('#Q_BRAND_ID', { label: brand.toUpperCase() });
                console.log(`已選擇廠牌: ${brand}`);

                // 等待 ASP.NET PostBack 觸發的遮罩轉圈圈消失，再等待車型選單載入超過 1 個選項
                await page.waitForTimeout(1000); // 先等它開始載入
                await page.waitForFunction(() => {
                    const opts = document.querySelectorAll('#Q_MODEL_ID option');
                    return opts.length > 1; // 必須要有大於一個選項(扣除"全部")才代表載入完成
                }, { timeout: 15000 });
                console.log('車型選單已正確更新');
            } catch (e) { console.log("等待車型選單載入逾時或失敗", e); }
        }

        if (model) {
            try {
                // 取得所有可用的車型選項
                const modelOptions = await page.$$eval('#Q_MODEL_ID option', opts => opts.map(o => ({ value: o.value, text: o.innerText.trim() })));
                const cleanModel = model.toUpperCase().replace(/[-\s]/g, ''); // 移除橫槓與空格

                let matchedModel = null;
                const validOptions = modelOptions.filter(o => o.text !== '全部' && o.value);

                // 優先級 1：完全符合 (無視橫槓與空白)
                matchedModel = validOptions.find(o => o.text.toUpperCase().replace(/[-\s]/g, '') === cleanModel);

                // 優先級 2：選單項目「開頭為」查詢字串 (避免 E CLASS 被 CLE CLASS 包含)
                if (!matchedModel) {
                    matchedModel = validOptions.find(o => o.text.toUpperCase().replace(/[-\s]/g, '').startsWith(cleanModel));
                }

                // 優先級 3：選單項目包含查詢字串，或查詢字串包含選單項目
                if (!matchedModel) {
                    matchedModel = validOptions.find(o => {
                        const cleanOption = o.text.toUpperCase().replace(/[-\s]/g, '');
                        return cleanOption.includes(cleanModel) || cleanModel.includes(cleanOption);
                    });
                }

                if (matchedModel && matchedModel.value) {
                    await page.selectOption('#Q_MODEL_ID', matchedModel.value);
                    console.log(`成功配對並選擇車型: ${matchedModel.text}`);
                } else {
                    console.log(`找不到完全吻合的車型「${model}」，將嘗試直接依 label 選擇... 可用的選項有:`, modelOptions.map(o => o.text).join(', '));
                    await page.selectOption('#Q_MODEL_ID', { label: model.toUpperCase() });
                }
            } catch (e) {
                console.log("車型設定失敗", e);
            }
        }

        if (year) {
            // 使用者表單手動輸入單一年份
            await page.fill('#Q_CAR_AGE_S', year);
            await page.fill('#Q_CAR_AGE_E', year);
        } else if (req.body.yearStart || req.body.yearEnd) {
            // AI 解析出來的範圍
            if (req.body.yearStart) await page.fill('#Q_CAR_AGE_S', req.body.yearStart);
            if (req.body.yearEnd) await page.fill('#Q_CAR_AGE_E', req.body.yearEnd);
        }

        if (req.body.ccStart) {
            await page.fill('#Q_TOLERANCE_S', req.body.ccStart);
        }
        if (req.body.ccEnd) {
            await page.fill('#Q_TOLERANCE_E', req.body.ccEnd);
        }

        console.log('點擊查詢並等待資料載入...');

        // 攔截並印出彈出視窗(例如: 資料過多請縮小範圍)
        page.on('dialog', async dialog => {
            console.log('【網頁彈出對話框】:', dialog.message());
            await dialog.accept();
        });

        await page.click('#QUERY_BTN1');

        // 等待表格載入
        try {
            await page.waitForSelector('#DataGrid', { timeout: 20000 });
        } catch (error) {
            console.log('找不到 DataGrid，可能無資料或發生錯誤，準備截圖...');
            await page.screenshot({ path: path.join(__dirname, 'reports', 'error_screenshot.png') });
            throw new Error('無法抓取到資料表格，請檢查是否有彈出錯誤訊息。截圖已儲存為 error_screenshot.png');
        }

        console.log('擷取結果清單...');
        let records = await page.$$eval('#DataGrid tr', rows => {
            // 第一列是標題
            return rows.map(row => {
                const cols = Array.from(row.querySelectorAll('td, th')).map(col => {
                    const imgs = col.querySelectorAll('img[onclick]');
                    if (imgs.length > 0) {
                        return Array.from(imgs).map(img => {
                            const onclick = img.getAttribute('onclick');
                            const match = onclick.match(/window\.open\('([^']+)'/);
                            if (match) {
                                // 轉成標準的超連結 a tag
                                const url = 'https://www.sinjang.com.tw/Portal/' + match[1];
                                return `<a href="${url}" target="_blank"><img src="${img.src}" style="width:20px; margin-right:5px; border:0;" title="查看細節"></a>`;
                            }
                            return '';
                        }).join('');
                    }
                    return col.innerText.trim().replace(/\s+/g, ' ');
                });
                return cols;
            });
        });

        // 篩選預算
        if (budgetMin || budgetMax) {
            const min = budgetMin ? parseFloat(budgetMin) * 10000 : 0;
            const max = budgetMax ? parseFloat(budgetMax) * 10000 : Infinity;
            const headers = records[0];
            const priceIdx = headers.findIndex(h => h.includes('成交價'));

            if (priceIdx !== -1) {
                records = records.filter((row, i) => {
                    if (i === 0) return true; // 保留標題
                    const priceStr = row[priceIdx];
                    if (!priceStr) return false;
                    const price = parseFloat(priceStr.replace(/,/g, ''));
                    return !isNaN(price) && price > 0 && price >= min && price <= max;
                });
            }
        }

        if (records.length <= 1) {
            return res.json({
                success: true,
                message: '查詢完成！但找不到符合條件的車輛。',
                reportUrl: '#'
            });
        }

        // 產生 CSV 檔案
        const headers = records[0].map(h => ({ id: h, title: h }));
        const dataRows = records.slice(1).map(row => {
            let obj = {};
            row.forEach((val, i) => {
                obj[records[0][i]] = val;
            });
            return obj;
        });

        const filename = `AIS_Report_${brand || 'ALL'}_${model || 'ALL'}_${Date.now()}.csv`.replace(/\s+/g, '_');
        const reportPath = path.join(__dirname, 'reports', filename);

        const ObjectCsvWriter = require('csv-writer').createObjectCsvWriter;
        const csvWriter = ObjectCsvWriter({
            path: reportPath,
            header: headers
        });

        // 給 CSV 用的無 HTML 乾淨資料
        const csvRows = records.slice(1).map(row => {
            let obj = {};
            row.forEach((val, i) => {
                obj[records[0][i]] = val.replace(/<[^>]+>/g, '').trim() || '詳見網頁版';
            });
            return obj;
        });

        await csvWriter.writeRecords(csvRows);
        console.log('CSV 報表已匯出：', reportPath);

        res.json({
            success: true,
            message: `查詢完成！共找到 ${dataRows.length} 筆資料。`,
            productionPeriod: productionPeriod,
            reportUrl: `/api/download/${filename}`,
            data: {
                headers: headers.map(h => h.title),
                rows: dataRows
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '爬蟲執行發生錯誤：' + err.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.get('/api/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'reports', req.params.filename);
    res.download(file);
});

app.listen(PORT, () => {
    console.log(`伺服器已啟動，請在瀏覽器打開 http://localhost:${PORT}`);
});
