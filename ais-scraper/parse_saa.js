const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('saa_form_dump.txt', 'utf-8');
const $ = cheerio.load(html);

const results = [];
$('.Condition td').each((i, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    const input = $(el).find('input, select').first();
    if (input.length) {
        results.push({
            label: text.substring(0, 20),
            id: input.attr('id'),
            name: input.attr('name'),
            type: input.attr('type') || input[0].tagName
        });
    }
});
console.log(JSON.stringify(results, null, 2));

// For checkboxes
console.log("\n--- Checkboxes ---");
$('input[type="checkbox"]').each((i, el) => {
    const id = $(el).attr('id');
    const label = $(`label[for="${id}"]`).text().trim();
    console.log(`Checkbox ID: ${id}, Name: ${$(el).attr('name')}, Value: ${$(el).attr('value')}, Label: ${label}`);
});
// For selects
console.log("\n--- Selects ---");
$('select').each((i, el) => {
    const id = $(el).attr('id');
    console.log(`Select ID: ${id}, Name: ${$(el).attr('name')}`);
});
