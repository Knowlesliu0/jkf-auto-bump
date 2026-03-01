const fs = require('fs');
const html = fs.readFileSync('test_login.html', 'utf8');
const links = html.match(/<a[^>]*href="[^"]*login[^"]*"[^>]*>/gi);
console.log("Found login links:", links ? links.length : 0);
if (links) {
    links.forEach(l => console.log(l));
}
