// يجمع ملفات web/src بالترتيب في web/fin.js
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'src');
const out = fs.readdirSync(dir).filter(f => /^\d\d_.*\.js$/.test(f)).sort().map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
new (require('vm').Script)(out, { filename: 'fin.js' });
// دالتان بنفس الاسم في نفس النطاق: الثانية تلغي الأولى بصمت، فنمنع ذلك
const seen = {}, dup = [];
for (const m of out.matchAll(/^    function ([A-Za-z0-9_$]+)\(/gm)) { if (seen[m[1]]) dup.push(m[1]); seen[m[1]] = 1; }
if (dup.length) { console.error('دوال مكررة: ' + dup.join(', ')); process.exit(1); }
fs.writeFileSync(path.join(__dirname, 'fin.js'), out);
console.log('fin.js', out.length, 'bytes');
