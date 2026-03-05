const fs = require('fs');
const html = fs.readFileSync('datagrid_full.html', 'utf-8');

// Find all elements with ID starting with Q_
const qIdMatches = html.matchAll(/id="(Q_[^"]+)"/g);
const ids = new Set();
for (const match of qIdMatches) {
    ids.add(match[1]);
}

console.log("=== Found Q_ IDs ===");
for (const id of ids) {
    // Find the surrounding td/div to extract label 
    const idx = html.indexOf(`id="${id}"`);
    const surrounding = html.substring(Math.max(0, idx - 500), idx + 200);
    const textMatches = surrounding.match(/>([^<]+)</g);
    let labels = textMatches ? textMatches.map(m => m.replace(/[<>]/g, '').trim()).filter(m => m && m.length > 1) : [];
    console.log(`- ${id} : Possible labels = ${labels.slice(0, 3).join(' | ')}`);
}

// Find all checkboxes with standard values
console.log("\n=== Found Checkboxes ===");
const cbMatches = html.matchAll(/type="checkbox"[^>]*id="([^"]+)"[^>]*value="([^"]+)"/g);
for (const match of cbMatches) {
    const id = match[1];
    const val = match[2];
    // Find label for this id
    const labelRegex = new RegExp(`<label[^>]*for="${id}"[^>]*>([^<]+)</label>`);
    const labelMatch = html.match(labelRegex);
    const label = labelMatch ? labelMatch[1].trim() : '-';
    // Let's filter out standard internal ones if they exist, only show those with values
    console.log(`CB id: ${id} | val: ${val} | label: ${label}`);
}
