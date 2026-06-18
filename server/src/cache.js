import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './config.js';

// Build a stable cache key from the inputs that affect the output. Including the
// file's mtime + size means an edited source image invalidates its cache entry.
export function cacheKey(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

// Shard by the first 2 hex chars so no single directory holds millions of files.
export function cachePathFor(kind, key, fmt) {
  return path.join(CACHE_DIR, kind, key.slice(0, 2), `${key}.${fmt}`);
}

export async function ensureDirFor(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

export function existsSync(p) {
  return fs.existsSync(p);
}
