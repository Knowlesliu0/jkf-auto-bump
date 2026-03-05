const fs = require('fs');

const html = fs.readFileSync('pagination_dump.html', 'utf8');

const selects = html.match(/<select[^>]*name="([^"]+)"[^>]*id="([^"]+)"/g);
console.log('Selects:');
if (selects) selects.forEach(s => console.log(s.match(/id="([^"]+)"/)[1] + " => " + s.match(/name="([^"]+)"/)[1]));

const inputs = html.match(/<input[^>]*type="text"[^>]*id="([^"]+)"/g);
console.log('\nText Inputs:');
if (inputs) inputs.forEach(i => console.log(i.match(/id="([^"]+)"/)[1]));

const cbs = html.match(/<input[^>]*type="checkbox"[^>]*id="([^"]+)"[^>]*value="([^"]+)"/g);
console.log('\nCheckboxes count:', cbs ? cbs.length : 0);
if (cbs) {
    cbs.slice(0, 20).forEach(c => {
        const id = c.match(/id="([^"]+)"/)[1];
        const val = c.match(/value="([^"]+)"/)[1];

        let label = '';
        const lMatch = html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([^<]+)</label>`));
        if (lMatch) label = lMatch[1].trim();

        console.log(`CheckBox: ${id} | Value: ${val} | Label: ${label}`);
    });
}
