const fs = require('node:fs');
const path = require('node:path');

const token = (process.env.CVAT_DEFAULT_PAT || '').trim();
const outputDir = path.join(__dirname, 'generated');
const outputPath = path.join(outputDir, 'default-token.cjs');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `module.exports = ${JSON.stringify(token)};\n`, { mode: 0o600 });
console.log(token ? 'Đã tạo PAT mặc định cho bản đóng gói.' : 'Không có CVAT_DEFAULT_PAT; bản đóng gói không chứa PAT mặc định.');
