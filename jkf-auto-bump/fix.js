const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('.git')) {
                results = results.concat(walk(file));
            }
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
        }
    });
    return results;
}
const files = walk('d:/Projects/jkf-auto-bump');
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('\`') || content.includes('\$')) {
        content = content.replace(/\`/g, '`').replace(/\\$/g, '$');
        fs.writeFileSync(f, content);
    }
});
