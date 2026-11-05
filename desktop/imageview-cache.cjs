const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class ImageViewCache {
  constructor(directory) {
    this.directory = directory;
    this.limitGB = 5;
    this.entries = new Map();
    this.pins = new Map();
    this.bytes = 0;
    this.tail = Promise.resolve();
    this.ready = this.initialize();
  }

  async initialize() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      const settings = JSON.parse(await fs.readFile(path.join(this.directory, 'settings.json'), 'utf8'));
      if (Number.isFinite(settings.limitGB) && settings.limitGB >= 0.1 && settings.limitGB <= 100) this.limitGB = settings.limitGB;
    } catch { /* Default quota on first run. */ }
    for (const file of await fs.readdir(this.directory)) {
      if (!/^[a-f0-9]{64}\.cache$/.test(file)) {
        if (/^[a-f0-9]{64}\..+\.tmp$/.test(file)) await fs.unlink(path.join(this.directory, file)).catch(() => {});
        continue;
      }
      const stat = await fs.stat(path.join(this.directory, file));
      this.entries.set(file, { size: stat.size, touched: stat.mtimeMs });
      this.bytes += stat.size;
    }
    await this.trim();
  }

  exclusive(action) {
    const result = this.tail.then(() => this.ready).then(action);
    this.tail = result.catch(() => {});
    return result;
  }

  filename(key) { return `${crypto.createHash('sha256').update(key).digest('hex')}.cache`; }
  protect(owner, keys) { this.pins.set(owner, new Set(keys.map(key => this.filename(key)))); }
  release(owner) { this.pins.delete(owner); }
  protected(file) { return [...this.pins.values()].some(files => files.has(file)); }

  async remove(file) {
    const entry = this.entries.get(file);
    if (!entry) return;
    await fs.unlink(path.join(this.directory, file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    this.bytes -= entry.size;
    this.entries.delete(file);
  }

  async trim() {
    const ordered = [...this.entries].sort((a, b) => a[1].touched - b[1].touched);
    for (const [file] of ordered) {
      if (this.bytes <= this.limitGB * 1024 ** 3) break;
      if (!this.protected(file)) await this.remove(file);
    }
  }

  read(key) {
    return this.exclusive(async () => {
      const file = this.filename(key);
      if (!this.entries.has(file)) return null;
      try {
        const buffer = await fs.readFile(path.join(this.directory, file));
        const separator = buffer.indexOf(10);
        if (separator < 0 || separator > 2048) throw new Error('Corrupt cache header');
        const header = JSON.parse(buffer.subarray(0, separator).toString('utf8'));
        if (!header.savedAt || !header.contentType?.startsWith('image/') || separator + 1 >= buffer.length) {
          throw new Error('Expired or corrupt cache');
        }
        const data = buffer.subarray(separator + 1);
        if (crypto.createHash('sha256').update(data).digest('hex') !== header.digest) throw new Error('Corrupt cache image');
        const now = Date.now();
        this.entries.get(file).touched = now;
        await fs.utimes(path.join(this.directory, file), new Date(now), new Date(now));
        return { data, contentType: header.contentType };
      } catch {
        await this.remove(file);
        return null;
      }
    });
  }

  write(key, value, canWrite = () => true) {
    return this.exclusive(async () => {
      if (!canWrite()) return;
      const header = JSON.stringify({ savedAt: Date.now(), contentType: value.contentType,
        digest: crypto.createHash('sha256').update(value.data).digest('hex') });
      const buffer = Buffer.concat([Buffer.from(`${header}\n`), value.data]);
      if (buffer.length > this.limitGB * 1024 ** 3) throw new Error('Cache đầy. Tăng giới hạn cache trong Cài đặt để lưu đủ Job.');
      const file = this.filename(key);
      const required = buffer.length - (this.entries.get(file)?.size || 0);
      for (const [old] of [...this.entries].sort((a, b) => a[1].touched - b[1].touched)) {
        if (this.bytes + required <= this.limitGB * 1024 ** 3) break;
        if (old !== file && !this.protected(old)) await this.remove(old);
      }
      if (this.bytes + required > this.limitGB * 1024 ** 3) throw new Error('Cache đầy. Tăng giới hạn cache trong Cài đặt để lưu đủ Job.');
      const temporary = path.join(this.directory, `${file.slice(0, -6)}.${crypto.randomUUID()}.tmp`);
      try {
        await fs.writeFile(temporary, buffer);
        if (!canWrite()) return;
        await this.remove(file);
        await fs.rename(temporary, path.join(this.directory, file));
        this.entries.set(file, { size: buffer.length, touched: Date.now() });
        this.bytes += buffer.length;
        await this.trim();
      } finally { await fs.unlink(temporary).catch(() => {}); }
    });
  }

  manage(request) {
    return this.exclusive(async () => {
      if (request.action === 'clear') for (const file of [...this.entries.keys()]) await this.remove(file);
      else if (request.action === 'configure') {
        if (!Number.isFinite(request.limitGB) || request.limitGB < 0.1 || request.limitGB > 100) throw new Error('Cache phải từ 0.1 đến 100 GB.');
        this.limitGB = request.limitGB;
        const temporary = path.join(this.directory, 'settings.json.tmp');
        await fs.writeFile(temporary, JSON.stringify({ limitGB: this.limitGB }));
        await fs.rename(temporary, path.join(this.directory, 'settings.json'));
        await this.trim();
      } else if (request.action !== 'info') throw new Error('Thao tác cache không hợp lệ.');
      return { bytes: this.bytes, entries: this.entries.size, limitGB: this.limitGB };
    });
  }
}

module.exports = { ImageViewCache };
