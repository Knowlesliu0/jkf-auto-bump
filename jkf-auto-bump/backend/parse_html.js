const fs = require('fs');
const html = fs.readFileSync('test_login.html', 'utf8');
const inputs = html.match(/<input[^>]*>/gi);
console.log("Found inputs:", inputs ? inputs.length : 0);
if (inputs) {
    inputs.forEach(m => console.log(m.substring(0, 100)));
}
const forms = html.match(/<form[^>]*>/gi);
console.log("\nFound forms:", forms ? forms.length : 0);
if (forms) {
    forms.forEach(f => console.log(f));
}
