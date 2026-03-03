const fs = require('fs');
const html = fs.readFileSync('result_page.html', 'utf8');

// Simple regex to find the table that contains "拍賣日期" and "成交價"
const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
let match;
while ((match = tableRegex.exec(html)) !== null) {
    if (match[1].includes('拍賣日期') && match[1].includes('成交價')) {
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        const rows = [];
        let rMatch;
        while ((rMatch = rowRegex.exec(match[1])) !== null) {
            rows.push(rMatch[1]);
        }
        console.log(`找到資料表，共 ${rows.length} 列`);
        if (rows.length > 2) {
            const tr = rows[2];
            const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cols = [];
            let cMatch;
            while ((cMatch = tdRegex.exec(tr)) !== null) {
                // remove HTML tags and trim
                cols.push(cMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' '));
            }
            console.log('第二列資料範例:');
            console.log(cols);
        }
        break;
    }
}
