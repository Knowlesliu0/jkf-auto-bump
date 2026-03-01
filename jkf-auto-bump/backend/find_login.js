const fs = require('fs');
const html = fs.readFileSync('test_login.html', 'utf8');

// A very basic extraction
const matches = [...html.matchAll(/<[^>]+>[^<]*登入[^<]*<\/[^>]+>/g)];
console.log(`Found ${matches.length} elements with 登入`);
matches.forEach((m, i) => {
    console.log(`Match ${i + 1}: ${m[0]}`);
});
