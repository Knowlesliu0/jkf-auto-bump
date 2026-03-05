const fs = require('fs');
const cheerio = require('cheerio');

try {
    const html = fs.readFileSync('pagination_dump.html', 'utf8');
    const $ = cheerio.load(html);

    const btns = [];
    $('a').each((i, el) => {
        const txt = $(el).text().trim();
        if (txt === '1' || txt === '2' || txt === '3' || txt === '＞' || txt === '>' || txt === '>>' || txt === '＞|') {
            btns.push({ text: txt, id: $(el).attr('id'), href: $(el).attr('href'), onclick: $(el).attr('onclick') });
        }
    });

    console.log("Found Pagination Links:");
    console.log(btns);

    const inputs = [];
    $('input[type="button"], input[type="submit"], button').each((i, el) => {
        const val = $(el).val() || $(el).text().trim();
        if (val.includes('下一頁') || val.includes('＞') || val.includes('>')) {
            inputs.push({ value: val, id: $(el).attr('id'), onclick: $(el).attr('onclick') });
        }
    });

    console.log("Found Pagination Buttons:");
    console.log(inputs);

} catch (e) {
    console.error(e);
}
