// يجمع ملفات web/src بالترتيب في web/fin.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'src');
const out = fs.readdirSync(dir).filter(f => /^\d\d_.*\.js$/.test(f)).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
new (require('vm').Script)(out, { filename: 'fin.js' });
fs.writeFileSync(path.join(__dirname, 'fin.js'), out);
console.log('fin.js', out.length, 'bytes');
