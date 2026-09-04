const fs = require('node:fs');
const path = require('node:path');

const releaseDir = path.resolve(__dirname, '..', 'release');
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });
console.log(`Cleaned release output: ${releaseDir}`);
