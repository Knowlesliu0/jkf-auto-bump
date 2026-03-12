const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 確保有資料夾放報告
if (!fs.existsSync(path.join(__dirname, 'reports'))) {
    fs.mkdirSync(path.join(__dirname, 'reports'));
}

// 自動清理報表，只保留最新 5 份
function cleanupReports() {
    const dir = path.join(__dirname, 'reports');
    try {
        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.csv'))
            .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time); // 最新在前
        if (files.length > 5) {
            files.slice(5).forEach(f => {
                fs.unlinkSync(path.join(dir, f.name));
                console.log(`🗑️ 已刪除舊報表: ${f.name}`);
            });
        }
    } catch (e) { /* ignore */ }
}

// Resilient select helper for dynamic ASP.NET postback pages.
async function selectOptionSafe(page, selector, target) {
    if (!target) return false;
    const desired = String(target).trim();
    if (!desired) return false;
    const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
    const desiredNorm = normalize(desired);

    const getSelected = async () => {
        try {
            return await page.$eval(selector, (select) => {
                const opt = select.options[select.selectedIndex];
                if (!opt) return null;
                return { value: opt.value || '', text: opt.text || '' };
            });
        } catch (e) {
            return null;
        }
    };

    const isMatch = (opt) => {
        if (!opt) return false;
        const text = normalize(opt.text);
        const value = normalize(opt.value);
        return (
            text === desiredNorm ||
            value === desiredNorm ||
            text.includes(desiredNorm) ||
            value.includes(desiredNorm)
        );
    };

    const trySelect = async (opts) => {
        try {
            const res = await page.selectOption(selector, opts);
            return Array.isArray(res) ? res.length > 0 : !!res;
        } catch (e) {
            return false;
        }
    };

    if (await trySelect({ value: desired })) {
        if (isMatch(await getSelected())) return true;
    }
    if (await trySelect({ label: desired })) {
        if (isMatch(await getSelected())) return true;
    }

    let matched = '';
    try {
        matched = await page.$eval(
            selector,
            (select, targetNorm) => {
                const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
                const t = targetNorm;
                const option = Array.from(select.options).find((o) => {
                    const text = norm(o.text);
                    const val = norm(o.value);
                    return text === t || val === t || text.includes(t) || val.includes(t);
                });
                if (!option) return '';
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return option.value;
            },
            desiredNorm
        );
    } catch (e) {
        return false;
    }

    if (!matched) return false;
    return isMatch(await getSelected());
}

function normalizeFuelLabel(fuel) {
    if (!fuel) return '';
    return fuel === '純電' ? '電動' : fuel;
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
    let aiRecommendation = '';

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
  "brand": "廠牌名稱(非常重要：必須是全大寫英文原名，例如 TOYOTA, HONDA, NISSAN, FORD, BENZ, BMW, LEXUS 等。絕對禁止使用中文例如「豐田」、「本田」。如果沒有提到請填空字串)",
  "model": "車型(例如 ALTIS, CR-V, FOCUS, 3 SERIES, C CLASS。絕對禁止胡亂編造或使用不存在的車型代號。如果無法確認請填空字串，請注意 BMW 車系通常是 X SERIES，BENZ 車系請填 C CLASS 等)",
  "yearStart": "出廠年份起(如果知道該代號的生產起頭年份，例如 E92 是 2006，請填 2006；如果沒有請填空字串)",
  "yearEnd": "出廠年份迄(如果知道該代號的停產年份，例如 E92 是 2013，請填 2013；如果使用者有指定單一特定年份，起訖填一樣；如果沒有請填空字串)",
  "ccStart": "排氣量起(單位為 cc，例如 335i 大約是 2979cc，如果是 2.0L 就是 1998cc 等，若不確定請填空。數字就好，例如 2900)",
  "ccEnd": "排氣量迄(單位為 cc，可稍微抓個範圍，例如 335i 可以填 3000。數字就好，例如 3000。若不確定請填空)",
  "budgetMin": "預算下限(如果有提到區間起點，只取出數字部分，單位為萬元，例如 50，沒有請填空字串)",
  "budgetMax": "預算上限(如果有提到區間迄點，或者最高預算，只取出數字部分，單位為萬元，例如 80，沒有請填空字串)",
  "productionPeriod": "該車款出廠期間(請務必同時包含年份與「月份」，例如：2017年6月~2022年8月。請不要只回答年份，若只知道年份也請查證該代號通常的發表與停產月份，若完全不知道請填空字串)",
  "aiRecommendation": "如果使用者的需求很籠統（例如「推薦高 CP 值的國產車」而沒有明確指定車款），請你發揮專業汽車顧問的能力，經過客觀分析後，挑選出「唯一一款」在台灣二手車市場真實存在、熱門且最符合條件的特定車型放入上述的 brand 與 model 欄位。並且在這個 aiRecommendation 欄位填寫你推薦這台車的簡短原因（約 50 字即可），你的推薦必須有憑有據，嚴禁產生幻覺或隨意捏造規格。如果使用者已經明確指定了某款車，這個欄位請填空字串。"
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
            if (parsed.aiRecommendation) aiRecommendation = parsed.aiRecommendation;
        } catch (e) {
            console.error('分析口語需求失敗:', e);
            // 如果使用者只填口語需求，且 AI 分析失敗，就中斷查詢避免跑進全域搜尋
            if (!brand && !model) {
                return res.json({ success: false, message: 'AI 分析需求失敗 (可能遭遇免費額度限制)，請直接改用上方欄位手動輸入查詢條件' });
            }
        }

        // 雙重保險：如果 AI 成功解析但沒有推薦出實質的對象，就阻止進入全系統盲搜
        if (!brand || !model) {
            return res.json({ success: false, message: 'AI 無法根據您的需求精確判斷出一款合適的車型，請提供更具體的條件（例如：推薦一款熱門的休旅車）。' });
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
        await page.click('#ctl00_BodyContent_LOGIN_BTN', { noWaitAfter: true });
        // 第一個防護網：等待網頁跳轉或載入錯誤訊息
        await page.waitForTimeout(3000);

        // 偵測是否登入失敗 (例如帳密錯誤停留在原頁面或出現提示)
        const loginBtnStillExists = await page.locator('#ctl00_BodyContent_LOGIN_BTN').isVisible().catch(() => false);
        const errorTextVisible = await page.locator('text=帳號或密碼錯誤').isVisible().catch(() => false); // 依據實際 SAA 錯誤訊息調整

        if (loginBtnStillExists || errorTextVisible) {
            throw new Error("登入失敗：請確認 AIS 帳號與密碼是否正確，或是否帳號已被其他的裝置登入過而被踢出，系統拒絕進入。");
        }

        // 進入 AIS 查詢頁面
        console.log('登入成功！正在前往 AIS 成交行情頁面...');
        await page.goto('https://www.sinjang.com.tw/Portal/BA0102_01.aspx', { waitUntil: 'domcontentloaded' });

        // 等待載入遮罩動畫結束 (可能存在也可能一開始就沒顯示)
        await page.waitForFunction(() => {
            const spinner = document.querySelector('#Progress_Img');
            return !spinner || window.getComputedStyle(spinner).display === 'none';
        }, { timeout: 30000 }).catch(() => { });


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
            // 先取得所有可用的廠牌選項文字
            const brandOptions = await page.$$eval('#Q_BRAND_ID option', opts => opts.map(o => o.innerText.trim().toUpperCase()));
            const targetBrand = brand.toUpperCase();

            // 若 AI 推薦的廠牌根本不存在清單內，嘗試別名對照
            const brandAliases = {
                'MERCEDES-BENZ': 'BENZ', 'MERCEDES': 'BENZ', 'M-BENZ': 'BENZ',
                'VOLKSWAGEN': 'VW', 'LAND ROVER': 'LANDROVER', 'ALFA ROMEO': 'ALFAROMEO'
            };
            let matchedBrand = targetBrand;
            if (!brandOptions.includes(targetBrand)) {
                // 試別名
                if (brandAliases[targetBrand] && brandOptions.includes(brandAliases[targetBrand])) {
                    matchedBrand = brandAliases[targetBrand];
                } else {
                    // 試部分匹配（例如 BENZ 在 MERCEDES-BENZ 裡面）
                    const found = brandOptions.find(b => b.includes(targetBrand) || targetBrand.includes(b));
                    if (found) {
                        matchedBrand = found;
                    } else {
                        throw new Error(`AI 分析建立的查詢條件異常：找不到廠牌 "${targetBrand}"。請嘗試提供更具體或常見的車輛需求！`);
                    }
                }
                console.log(`廠牌別名對照: ${targetBrand} → ${matchedBrand}`);
            }

            try {
                await page.selectOption('#Q_BRAND_ID', { label: matchedBrand }, { noWaitAfter: true });
                console.log(`已選擇廠牌: ${matchedBrand}`);

                // 等待 ASP.NET PostBack 觸發的遮罩轉圈圈消失，再等待車型選單載入超過 1 個選項
                await page.waitForTimeout(1000); // 先等它開始載入
                await page.waitForFunction(() => {
                    const opts = document.querySelectorAll('#Q_MODEL_ID option');
                    return opts.length > 1; // 必須要有大於一個選項(扣除"全部")才代表載入完成
                }, { timeout: 15000 });
                console.log('車型選單已正確更新');
            } catch (e) {
                console.log("等待車型選單載入逾時或失敗", e);
                throw new Error(`選擇廠牌 "${matchedBrand}" 後發生異常。`);
            }
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
                    await page.selectOption('#Q_MODEL_ID', matchedModel.value, { noWaitAfter: true });
                    console.log(`成功配對並選擇車型: ${matchedModel.text}`);
                } else {
                    console.log(`找不到完全吻合的車型「${model}」，將嘗試直接依 label 選擇... 可用的選項有:`, modelOptions.map(o => o.text).join(', '));
                    await page.selectOption('#Q_MODEL_ID', { label: model.toUpperCase() }, { noWaitAfter: true });
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

        // 加入新的額外搜尋條件 (依照前端傳來的選項填寫)
        if (req.body.doors) await page.selectOption('#Q_CAR_DOOR', req.body.doors).catch(() => { });
        if (req.body.mileage) await page.selectOption('#Q_SPEEDOMETER', req.body.mileage).catch(() => { });
        if (req.body.transmission) await page.selectOption('#Q_WD', { label: req.body.transmission }).catch(() => { });
        if (req.body.gear) await page.selectOption('#Q_GEAR_TYPE', { label: req.body.gear }).catch(() => { });
        if (req.body.fuel) {
            const fuelLabel = normalizeFuelLabel(req.body.fuel);
            const fuelSelected = await selectOptionSafe(page, '#Q_OIL_TYPE', fuelLabel);
            if (!fuelSelected) console.log(`燃油選擇失敗: ${fuelLabel}`);
        }

        // 設定車體評價：根據前端勾選的項目
        try {
            const selectedGrades = req.body.grades || []; // 前端傳來的陣列，例如 ["A+", "A", "B+", "B", "C"]
            console.log('設定車體評價:', selectedGrades);

            // 先取消「全選」
            const selectAll = page.getByLabel('全選', { exact: true });
            if (await selectAll.count() > 0) {
                await selectAll.uncheck({ force: true });
                await page.waitForTimeout(500); // 稍微等待一下讓 JS 觸發
            }

            // 所有的評價等級名單
            const allGrades = ['A+', 'A', 'B+', 'B', 'C', 'D', 'E', 'N', 'W'];

            for (const grade of allGrades) {
                const cb = page.getByLabel(grade, { exact: true });
                if (await cb.count() > 0) {
                    if (selectedGrades.includes(grade)) {
                        await cb.check({ force: true });
                    } else {
                        await cb.uncheck({ force: true });
                    }
                }
            }

        } catch (e) {
            console.log("車體評價設定失敗:", e);
        }


        await page.waitForFunction(() => {
            const spinner = document.querySelector('#Progress_Img');
            return !spinner || window.getComputedStyle(spinner).display === 'none';
        }, { timeout: 15000 }).catch(() => { });

        // Re-apply fuel right before submit in case of any postback resets.
        if (req.body.fuel) {
            const fuelLabel = normalizeFuelLabel(req.body.fuel);
            const fuelSelected = await selectOptionSafe(page, '#Q_OIL_TYPE', fuelLabel);
            if (!fuelSelected) console.log(`燃油選擇失敗(送出前): ${fuelLabel}`);
        }

        console.log('點擊查詢並等待資料載入...');

        // 攔截並印出彈出視窗(例如: 資料過多請縮小範圍)
        page.on('dialog', async dialog => {
            console.log('【網頁彈出對話框】:', dialog.message());
            await dialog.accept();
        });

        await page.click('#QUERY_BTN1', { noWaitAfter: true });

        // 等待表格載入
        try {
            await page.waitForFunction(() => {
                const spinner = document.querySelector('#Progress_Img');
                return !spinner || window.getComputedStyle(spinner).display === 'none';
            }, { timeout: 30000 });
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
        cleanupReports();
        console.log('CSV 報表已匯出：', reportPath);

        res.json({
            success: true,
            message: `查詢完成！共找到 ${dataRows.length} 筆資料。`,
            productionPeriod: productionPeriod,
            aiRecommendation: aiRecommendation,
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

app.post('/api/scrape-auction', async (req, res) => {
    let { username, password, requests } = req.body;
    // fallback 到 .env
    username = username || process.env.AIS_USERNAME;
    password = password || process.env.AIS_PASSWORD;

    if (!requests || !Array.isArray(requests) || requests.length === 0) {
        return res.json({ success: false, message: '未提供任何客戶需求。' });
    }

    let browser;
    try {
        browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
        const page = await context.newPage();

        console.log('正在前往 SAA 首頁登入頁面...');
        await page.goto('https://www.sinjang.com.tw/Portal/');

        console.log('輸入帳號密碼...(拍賣批次比對模式)');
        await page.fill('#ctl00_BodyContent_ACCOUNT', username);
        await page.fill('#ctl00_BodyContent_PASSWORD', password);

        console.log('點擊登入按鈕並等待跳轉...');
        await page.click('#ctl00_BodyContent_LOGIN_BTN', { noWaitAfter: true });
        await page.waitForTimeout(3000);

        const loginBtnStillExists = await page.locator('#ctl00_BodyContent_LOGIN_BTN').isVisible().catch(() => false);
        const errorTextVisible = await page.locator('text=帳號或密碼錯誤').isVisible().catch(() => false);

        if (loginBtnStillExists || errorTextVisible) {
            throw new Error("登入失敗：請確認帳號與密碼是否正確，或帳號已被踢出。");
        }

        console.log('登入成功！正在前往 SAA 近期拍賣場次行事曆...');
        await page.goto('https://www.sinjang.com.tw/Portal/AUC2101_.aspx?EventPop=N', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        let auctionPage = page;
        // 尋找行事曆上的紅色小汽車圖示並點擊
        console.log('正在尋找最近的拍賣場次圖示（紅色小車）...');
        const redCarLocator = page.locator('img[src*="ico_car"], img[src*="Icon_ca"], img[src*="icon8"], img[onclick*="CARDETAIL"], img[onclick*="TICARDETAIL"], a[href*="CARDETAIL"]');

        const count = await redCarLocator.count();
        if (count > 0) {
            // 計算「今天」的 YYYYMMDD (根據本地時間)
            const today = new Date();
            const todayNum = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`, 10);

            let bestDate = Infinity;
            let chosenElIndex = -1;

            for (let i = 0; i < count; i++) {
                const outerHTML = await redCarLocator.nth(i).evaluate(e => e.outerHTML);
                const match = outerHTML.match(/BID_DATE=(\d{8})/);
                if (match) {
                    const dNum = parseInt(match[1], 10);
                    // 尋找大於等於今天，且最接近今天的場次
                    if (dNum >= todayNum && dNum < bestDate) {
                        bestDate = dNum;
                        chosenElIndex = i;
                    }
                }
            }

            if (chosenElIndex === -1) {
                console.log(`⚠️ 找不到大於等於今天(${todayNum})的場次，退而求其次點擊第一個`);
                chosenElIndex = 0;
            } else {
                console.log(`找到了今天或之後最近的拍賣場次：${bestDate}`);
            }

            const newPagePromise = context.waitForEvent('page').catch(() => null);
            await redCarLocator.nth(chosenElIndex).click({ noWaitAfter: true });
            // 等待最多 8 秒看是否有彈出新視窗
            const newPage = await Promise.race([
                newPagePromise,
                new Promise(resolve => setTimeout(() => resolve(null), 8000))
            ]);

            if (newPage) {
                auctionPage = newPage;
                console.log("偵測到 SAA 開啟了獨立視窗，將切換至該視窗操作...");
                await auctionPage.waitForLoadState('domcontentloaded').catch(() => { });
            } else {
                // fallback：掃描 context 裡所有頁面找 CARDETAIL
                await page.waitForTimeout(3000);
                const allPages = context.pages();
                console.log(`context 中共有 ${allPages.length} 個頁面`);
                for (const p of allPages) {
                    const pUrl = p.url();
                    console.log(`  頁面 URL: ${pUrl}`);
                    if (pUrl.includes('CARDETAIL') || pUrl.includes('TICARDETAIL')) {
                        auctionPage = p;
                        console.log("從 context.pages() 找到 CARDETAIL 頁面！");
                        break;
                    }
                }
                if (auctionPage === page) {
                    console.log("在原頁面中轉跳拍賣清單...");
                }
            }

            console.log('已點擊拍賣場次，準備進入車輛清單...');
        } else {
            throw new Error("在行事曆上找不到近期的拍賣場次紅色小汽車圖示。");
        }

        // 等待 CARDETAIL.aspx 載入
        await auctionPage.waitForTimeout(5000);
        await auctionPage.waitForLoadState('domcontentloaded').catch(() => { });
        await auctionPage.waitForFunction(() => {
            const spinner = document.querySelector('#Progress_Img');
            return !spinner || window.getComputedStyle(spinner).display === 'none';
        }, { timeout: 30000 }).catch(() => { });
        console.log(`auctionPage 載入後 URL: ${auctionPage.url()}`);

        // 處理自動對話框接收 (例如資料過多)
        auctionPage.on('dialog', async dialog => await dialog.accept());

        let allMatchedRows = [];
        let notices = [];

        // 迴圈處理每位客戶的需求
        for (const [index, currentReq] of requests.entries()) {
            let { aucClientName, aucBrand, aucModel, aucYearStart, aucYearEnd, aucNoStart, aucNoEnd, aucCCStart, aucCCEnd, aucCarNo, aucFuel, aucTransmission, aucParams, aucColors, aucDoors, aucGrades, aucCarTypes } = currentReq;
            console.log(`\n========================================`);
            console.log(`開始處理第 ${index + 1} 位客戶需求：${aucClientName}`);

            if (index > 0) {
                // 每跑完一位，必須清除上一位的查詢條件
                console.log('清除上一位客戶的查詢條件...');
                const clearBtn = await auctionPage.getByRole('button', { name: '清 除' }).or(auctionPage.locator('input[value="清 除"]'));
                if (await clearBtn.count() > 0) {
                    await clearBtn.click({ noWaitAfter: true });
                    await auctionPage.waitForTimeout(2000); // 等待畫面重置
                } else {
                    console.log('找不到清除按鈕，無法重置...');
                }
            }

            console.log('填寫查詢條件...');
            if (aucBrand) {
                try {
                    await auctionPage.selectOption('#Q_BRAND_ID', { label: aucBrand.toUpperCase() }, { noWaitAfter: true });
                    await auctionPage.waitForTimeout(1000);
                    await auctionPage.waitForFunction(() => {
                        const opts = document.querySelectorAll('#Q_MODEL_ID option');
                        return opts.length > 1;
                    }, { timeout: 15000 });
                } catch (e) { console.log('廠牌選擇異常或逾時', e); }
            }

            if (aucModel) {
                try {
                    const modelOptions = await auctionPage.$$eval('#Q_MODEL_ID option', opts => opts.map(o => ({ value: o.value, text: o.innerText.trim() })));
                    const cleanModel = aucModel.toUpperCase().replace(/[-\s]/g, '');

                    const validOptions = modelOptions.filter(o => o.text !== '全部' && o.value);
                    let matchedModel = validOptions.find(o => o.text.toUpperCase().replace(/[-\s]/g, '') === cleanModel) ||
                        validOptions.find(o => o.text.toUpperCase().replace(/[-\s]/g, '').startsWith(cleanModel)) ||
                        validOptions.find(o => {
                            const cleanOption = o.text.toUpperCase().replace(/[-\s]/g, '');
                            return cleanOption.includes(cleanModel) || cleanModel.includes(cleanOption);
                        });

                    if (!matchedModel) {
                        console.log(`⚠️ 客戶 ${aucClientName}：該場次未上架「${aucBrand} ${aucModel}」車型，跳過此客戶。`);
                        notices.push(`⚠️ 客戶「${aucClientName}」：該場次未上架「${aucBrand} ${aucModel}」車型`);
                        continue;
                    }

                    await auctionPage.selectOption('#Q_MODEL_ID', matchedModel.value, { noWaitAfter: true }).catch(async () => {
                        await auctionPage.selectOption('#Q_MODEL_ID', { label: aucModel.toUpperCase() }, { noWaitAfter: true });
                    });
                } catch (e) { console.log("車型選擇失敗", e); }
            }

            if (aucYearStart) await auctionPage.fill('#Q_CAR_AGE_S', aucYearStart).catch(() => { });
            if (aucYearEnd) await auctionPage.fill('#Q_CAR_AGE_E', aucYearEnd).catch(() => { });
            if (aucTransmission) await auctionPage.selectOption('#Q_TRANS', aucTransmission).catch(() => { });

            // 其他細步條件在畫面上直接填寫，節省後續過濾資源
            if (aucNoStart) await auctionPage.fill('#Q_BID_SERNO_S', aucNoStart).catch(() => { });
            if (aucNoEnd) await auctionPage.fill('#Q_BID_SERNO_E', aucNoEnd).catch(() => { });
            if (aucCCStart) await auctionPage.fill('#Q_TOLERANCE_S', aucCCStart).catch(() => { });
            if (aucCCEnd) await auctionPage.fill('#Q_TOLERANCE_E', aucCCEnd).catch(() => { });
            if (aucCarNo) await auctionPage.fill('#Q_CAR_NUMBER', aucCarNo).catch(() => { });
            if (aucFuel) {
                const fuelLabel = normalizeFuelLabel(aucFuel);
                const fuelSelected = await selectOptionSafe(auctionPage, '#Q_OIL_TYPE', fuelLabel);
                if (!fuelSelected) console.log(`燃油選擇失敗: ${fuelLabel}`);
            }

            // Checkboxes
            if (aucColors && aucColors.length > 0) {
                await auctionPage.uncheck('#Q_ALL_COLOR').catch(() => { });
                const colorMap = { '白': '0', '黑': '1', '銀': '2', '深灰': '3', '紅': '4', '藍': '5', '黃': '6', '其他': '7' };
                for (const c of aucColors) {
                    if (colorMap[c] !== undefined) await auctionPage.check(`#Q_COLOR_${colorMap[c]}`).catch(() => { });
                }
            }
            if (aucDoors && aucDoors.length > 0) {
                await auctionPage.uncheck('#Q_ALL_CAR_DOOR').catch(() => { });
                const doorMap = { '2': '0', '3': '1', '4': '2', '5': '3' };
                for (const d of aucDoors) {
                    if (doorMap[d] !== undefined) await auctionPage.check(`#Q_CAR_DOOR_${doorMap[d]}`).catch(() => { });
                }
            }
            if (aucGrades && aucGrades.length > 0) {
                await auctionPage.uncheck('#Q_ALL_OUTSIDE_POINT').catch(() => { });
                const gradeMap = { 'A+': '0', 'A': '1', 'B+': '2', 'B': '3', 'C': '4', 'D': '5', 'E': '6', 'N': '7', 'W': '8' };
                for (const g of aucGrades) {
                    if (gradeMap[g] !== undefined) await auctionPage.check(`#Q_OUTSIDE_POINT_${gradeMap[g]}`).catch(() => { });
                }
            }
            if (aucCarTypes && aucCarTypes.length > 0) {
                await auctionPage.uncheck('#Q_ALL_TYPE').catch(() => { });
                const typeMap = { '白牌機車': '0', '重型機車': '1', '大貨車': '2', '小客車': '3', '小客貨': '4', '小貨車': '5', '拖曳車': '6' };
                for (const t of aucCarTypes) {
                    if (typeMap[t] !== undefined) await auctionPage.check(`#Q_TYPE_${typeMap[t]}`).catch(() => { });
                }
            }

            // Re-apply fuel before submit in case of any resets.
            if (aucFuel) {
                const fuelLabel = normalizeFuelLabel(aucFuel);
                const fuelSelected = await selectOptionSafe(auctionPage, '#Q_OIL_TYPE', fuelLabel);
                if (!fuelSelected) console.log(`燃油選擇失敗(送出前): ${fuelLabel}`);
            }

            console.log('點擊查詢並等待表格載入...');

            // 手動模擬 ASP.NET __doPostBack 的行為
            // __doPostBack 內部用了 arguments.callee，在 Playwright strict mode 下無法執行
            // 所以直接設 hidden fields + submit form
            await auctionPage.evaluate(() => {
                const form = document.forms[0];
                if (!form) return;
                let et = form.querySelector('#__EVENTTARGET') || form.querySelector('[name="__EVENTTARGET"]');
                let ea = form.querySelector('#__EVENTARGUMENT') || form.querySelector('[name="__EVENTARGUMENT"]');
                if (et) et.value = 'QUERY_BTN';
                if (ea) ea.value = '';
                form.submit();
            });
            console.log('已手動模擬 __doPostBack 提交查詢表單');

            // 等待查詢結果載入
            await auctionPage.waitForTimeout(5000);
            await auctionPage.waitForFunction(() => {
                const spinner = document.querySelector('#Progress_Img');
                return !spinner || window.getComputedStyle(spinner).display === 'none';
            }, { timeout: 30000 }).catch(() => { });

            // Debug: dump 第一列的 HTML
            const debugHtml = await auctionPage.evaluate(() => {
                const grid = document.querySelector('#DataGrid') || document.querySelector('table.Grid');
                if (!grid) return 'No grid found';
                const rows = grid.querySelectorAll('tr');
                if (rows.length < 2) return 'No data rows';
                // 抓第二列（第一列是表頭）
                const row = rows[1];
                const cells = row.querySelectorAll('td');
                const cellInfo = [];
                cells.forEach((cell, i) => {
                    const imgs = cell.querySelectorAll('img');
                    const anchors = cell.querySelectorAll('a');
                    cellInfo.push({
                        index: i,
                        text: cell.innerText.trim().substring(0, 30),
                        imgCount: imgs.length,
                        anchorCount: anchors.length,
                        html: cell.innerHTML.trim().substring(0, 200)
                    });
                });
                return JSON.stringify(cellInfo, null, 2);
            });
            console.log('=== CARDETAIL 第一列結構 ===');
            console.log(debugHtml);
            console.log('===========================');

            let allRecords = [];
            let isFirstPage = true;
            let recordsHeader = null;

            while (true) {
                try {
                    await auctionPage.waitForFunction(() => {
                        const spinner = document.querySelector('#Progress_Img');
                        return !spinner || window.getComputedStyle(spinner).display === 'none';
                    }, { timeout: 30000 });
                    await auctionPage.waitForSelector('#DataGrid, table.Grid', { timeout: 10000 });
                } catch (e) {
                    if (isFirstPage) {
                        console.log(`⚠️ 無法抓取到客戶 ${aucClientName} 的拍賣資料表格，可能沒有該條件的車或發生逾時。`);
                    }
                    break; // 離開迴圈，可能沒有下一頁了
                }

                // 抓取當前頁面表格資料（含查看資料連結）
                const pageRecords = await auctionPage.evaluate(() => {
                    const grid = document.querySelector('#DataGrid') || document.querySelector('table.Grid');
                    if (!grid) return [];
                    const rows = Array.from(grid.querySelectorAll('tr'));
                    const data = [];
                    rows.forEach(row => {
                        const cols = Array.from(row.querySelectorAll('th, td'));
                        const rowData = cols.map(col => {
                            // 檢查是否含有帶 window.open 的圖示或連結
                            const imgs = col.querySelectorAll('img[onclick*="window.open"]');
                            const anchors = col.querySelectorAll('a[href*="CARIFRAME"], a[onclick*="window.open"]');
                            const clickables = [...imgs, ...anchors];
                            if (clickables.length > 0) {
                                const links = [];
                                clickables.forEach(el => {
                                    const onclick = el.getAttribute('onclick') || '';
                                    const href = el.getAttribute('href') || '';
                                    const src = el.getAttribute('src') || '';
                                    const match = onclick.match(/window\.open\('([^']+)'/) || href.match(/window\.open\('([^']+)'/);
                                    if (match) {
                                        let url = match[1].replace(/&amp;/g, '&');
                                        if (!url.startsWith('http')) url = 'https://www.sinjang.com.tw/Portal/' + url;
                                        // 判斷類型
                                        let type = 'other';
                                        if (onclick.includes('KIND=record') || src.includes('icon04')) type = 'record';
                                        else if (onclick.includes('KIND=photo') || src.includes('icon05')) type = 'photo';
                                        else if (onclick.includes('KIND=check') || src.includes('icon06')) type = 'check';
                                        else if (onclick.includes('record') || el.title?.includes('監理')) type = 'record';
                                        else if (onclick.includes('photo') || el.title?.includes('照片')) type = 'photo';
                                        else if (onclick.includes('check') || el.title?.includes('查定')) type = 'check';
                                        links.push({ type, url });
                                    }
                                });
                                if (links.length > 0) return JSON.stringify({ __links: links });
                            }
                            return col.innerText.trim();
                        });
                        if (rowData.length > 0) data.push(rowData);
                    });
                    return data;
                });

                if (pageRecords && pageRecords.length > 1) {
                    if (isFirstPage) {
                        recordsHeader = pageRecords[0];
                        allRecords.push(recordsHeader); // 存入表頭
                        isFirstPage = false;
                    }
                    // 將扣除表頭的資料存入總陣列
                    allRecords = allRecords.concat(pageRecords.slice(1));
                    console.log(`客戶 ${aucClientName} : 目前已累積抓取 ${allRecords.length - 1} 筆資料...`);
                } else if (isFirstPage) {
                    console.log(`客戶 ${aucClientName} 目前沒有符合條件的車輛。`);
                    break;
                }

                // 嘗試找尋下一頁按鈕
                const hasNextPage = await auctionPage.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));

                    // 1. 找 "＞" 或 ">" 或 "下一頁"
                    let nextLnk = links.find(a => a.innerText.trim() === '＞' || a.innerText.trim() === '>' || a.innerText.trim() === '下一頁');
                    if (nextLnk && nextLnk.href && nextLnk.href.includes('javascript:')) {
                        nextLnk.click();
                        return true;
                    }

                    // 2. 找尋數字下一頁 (例如現在是 1，找 2)
                    const activeSpan = document.querySelector('.CurrentPage, span[style*="color:Red"]');
                    if (activeSpan) {
                        const currentNum = parseInt(activeSpan.innerText.trim(), 10);
                        if (!isNaN(currentNum)) {
                            const nextNumLnk = links.find(a => a.innerText.trim() === (currentNum + 1).toString());
                            if (nextNumLnk && nextNumLnk.href && nextNumLnk.href.includes('javascript:')) {
                                nextNumLnk.click();
                                return true;
                            }
                        }
                    }

                    // 3. 找尋 "下十頁" (如果前兩種都沒找到且數字剛好是 10 的倍數)
                    const next10Lnk = links.find(a => a.innerText.trim() === '下十頁');
                    if (next10Lnk && next10Lnk.href && next10Lnk.href.includes('javascript:')) {
                        next10Lnk.click();
                        return true;
                    }

                    return false;
                });

                if (hasNextPage) {
                    console.log('--- 準備翻頁，等待資料載入 ---');
                    await auctionPage.waitForTimeout(3000);
                } else {
                    console.log('已達最後一頁。');
                    break;
                }
            }

            if (allRecords.length < 2) {
                continue; // 真的沒車
            }

            // 將陣列轉為以 title 為 index 的物件，並標注該資料屬誰
            let dataRows = allRecords.slice(1).map(row => {
                let obj = { '對應客戶': aucClientName }; // 在第一欄加入標籤
                row.forEach((val, i) => {
                    obj[recordsHeader[i]] = val;
                });
                return obj;
            });

            // 本地端二次文字與條件過濾
            if (aucParams) {
                const keywords = aucParams.split(',').map(k => k.trim()).filter(k => k);
                dataRows = dataRows.filter(row => {
                    const fullText = Object.values(row).join(' ');
                    return keywords.every(kw => fullText.includes(kw));
                });
            }

            // 拍賣編號過濾 (例如: 81001 ~ 85001)
            if (aucNoStart || aucNoEnd) {
                dataRows = dataRows.filter(row => {
                    const no = parseInt(row['拍賣編號'], 10);
                    if (isNaN(no)) return true; // 若解析失敗則放行
                    if (aucNoStart && no < parseInt(aucNoStart, 10)) return false;
                    if (aucNoEnd && no > parseInt(aucNoEnd, 10)) return false;
                    return true;
                });
            }

            // 排氣量過濾 (例如: 1800 ~ 2400)
            if (aucCCStart || aucCCEnd) {
                dataRows = dataRows.filter(row => {
                    const ccText = row['排氣量'] || row['CC數'] || '0';
                    const cc = parseInt(ccText.replace(/\D/g, ''), 10);
                    if (isNaN(cc) || cc === 0) return true;
                    if (aucCCStart && cc < parseInt(aucCCStart, 10)) return false;
                    if (aucCCEnd && cc > parseInt(aucCCEnd, 10)) return false;
                    return true;
                });
            }

            // 車牌過濾
            if (aucCarNo) {
                dataRows = dataRows.filter(row => {
                    const carNo = row['車牌'] || row['車號'] || row['廠牌/車型/車號'] || Object.values(row).join(' ');
                    return carNo.toUpperCase().includes(aucCarNo.toUpperCase());
                });
            }

            // 燃油過濾
            if (aucFuel) {
                dataRows = dataRows.filter(row => {
                    const fuel = row['燃油'] || row['動力'] || Object.values(row).join(' ');
                    return fuel.includes(aucFuel);
                });
            }

            // 車顏色過濾 (多選)
            if (aucColors && aucColors.length > 0) {
                dataRows = dataRows.filter(row => {
                    const colorVal = row['車色'] || row['顏色'] || Object.values(row).join(' ');
                    return aucColors.some(c => colorVal.includes(c));
                });
            }

            // 車門數過濾 (多選)
            if (aucDoors && aucDoors.length > 0) {
                dataRows = dataRows.filter(row => {
                    const doorVal = row['車門數'] || row['門數'] || Object.values(row).join(' ');
                    return aucDoors.some(d => doorVal.includes(d + '門') || doorVal === d);
                });
            }

            // 車體評價過濾 (多選)
            if (aucGrades && aucGrades.length > 0) {
                dataRows = dataRows.filter(row => {
                    const gradeVal = row['評價'] || row['車體評價'] || Object.values(row).join(' ');
                    // 精確尋找匹配字串，如 'A' 不該匹配 'A+'
                    return aucGrades.some(g => {
                        const regex = new RegExp(`\\b${g.replace(/\+/g, '\\+')}\\b`, 'i');
                        return regex.test(gradeVal) || gradeVal === g;
                    });
                });
            }

            // 車種過濾 (多選)
            if (aucCarTypes && aucCarTypes.length > 0) {
                dataRows = dataRows.filter(row => {
                    const typeVal = row['車種'] || row['車型'] || row['分類'] || Object.values(row).join(' ');
                    return aucCarTypes.some(t => typeVal.includes(t));
                });
            }

            console.log(`客戶 ${aucClientName} 成功找到 ${dataRows.length} 筆資料。`);

            if (dataRows.length > 0) {
                allMatchedRows = allMatchedRows.concat(dataRows);
            }
        } // 迴圈結束

        if (allMatchedRows.length === 0) {
            const noticeText = notices.length > 0 ? '\n' + notices.join('\n') : '';
            return res.json({ success: true, message: `抓取成功，但所有客戶的條件都未找到符合的車輛。${noticeText}`, data: { headers: [], rows: [] } });
        }

        // 整理 CSV Headers
        const sampleKeys = Object.keys(allMatchedRows[0]);
        const headers = sampleKeys.map(k => ({ id: k, title: k }));

        // 匯出 CSV
        const filename = `AIS_Batch_Auction_${Date.now()}.csv`.replace(/\s+/g, '_');
        const reportPath = path.join(__dirname, 'reports', filename);
        const ObjectCsvWriter = require('csv-writer').createObjectCsvWriter;
        const csvWriter = ObjectCsvWriter({ path: reportPath, header: headers });
        await csvWriter.writeRecords(allMatchedRows);
        cleanupReports();

        // Debug: 印出第一筆 row 看格式
        console.log('=== 回傳資料第一筆 ===');
        console.log(JSON.stringify(allMatchedRows[0], null, 2));
        console.log('======================');

        const noticeText = notices.length > 0 ? '\n' + notices.join('\n') : '';

        res.json({
            success: true,
            message: `查詢成功！共為 ${requests.length} 位客戶比對到 ${allMatchedRows.length} 筆近期拍賣車輛。${noticeText}`,
            reportUrl: `/api/download/${filename}`,
            data: { headers: sampleKeys, rows: allMatchedRows }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: '比對執行發生錯誤：' + err.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.get('/api/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'reports', req.params.filename);
    res.download(file);
});

app.listen(PORT, () => {
    console.log(`伺服器已啟動，請在瀏覽器打開 http://localhost:${PORT}`);
});
