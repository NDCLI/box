const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tokenFile = path.join(root, 'token.txt');
const outputDir = path.join(__dirname, 'generated');
const outputPath = path.join(outputDir, 'default-tokens.cjs');
const tokens = {};

if (fs.existsSync(tokenFile)) {
  for (const rawLine of fs.readFileSync(tokenFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const server = line.slice(0, separator).trim().replace(/\/+$/, '').toLowerCase();
    const token = line.slice(separator + 1).trim();
    if (server && token) tokens[server] = token;
  }
}

const fallback = (process.env.CVAT_DEFAULT_PAT || '').trim();
if (fallback && Object.keys(tokens).length === 0) tokens['*'] = fallback;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `module.exports = ${JSON.stringify(tokens)};\n`, { mode: 0o600 });
console.log(Object.keys(tokens).length ? `Đã tạo ${Object.keys(tokens).length} PAT mặc định theo server.` : 'Không có PAT mặc định; bản đóng gói yêu cầu nhập token.');
