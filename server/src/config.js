import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PORT = Number(process.env.PORT) || 8787;

// User-editable list of browsable roots. Each root becomes a top-level folder
// on the home screen. File path: server/roots.json
const ROOTS_FILE = path.join(__dirname, '..', 'roots.json');

function existing(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function expandHome(p) {
  return p.replace(/^~(?=$|[/\\])/, os.homedir());
}

// Priority: roots.json  >  PHOTO_ROOTS env  >  PHOTO_ROOT env  >  sensible defaults.
function rawRoots() {
  if (existing(ROOTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(ROOTS_FILE, 'utf8'));
      const arr = Array.isArray(data) ? data : data.roots;
      if (Array.isArray(arr) && arr.length) {
        return arr.map((r) => ({ name: r.name, path: r.path }));
      }
    } catch (e) {
      console.error('roots.json 파싱 실패:', e.message);
    }
  }

  // PHOTO_ROOTS="사진=/path/a;외장=/Volumes/Drive"
  if (process.env.PHOTO_ROOTS) {
    return process.env.PHOTO_ROOTS.split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((pair) => {
        const eq = pair.indexOf('=');
        return eq === -1
          ? { name: path.basename(pair), path: pair }
          : { name: pair.slice(0, eq).trim(), path: pair.slice(eq + 1).trim() };
      });
  }

  // Single root (backwards compatible)
  if (process.env.PHOTO_ROOT) {
    return [{ name: path.basename(process.env.PHOTO_ROOT) || 'root', path: process.env.PHOTO_ROOT }];
  }

  // Defaults: whichever of these exist on this Mac.
  const home = os.homedir();
  return [
    { name: '사진', path: path.join(home, 'Pictures') },
    { name: '다운로드', path: path.join(home, 'Downloads') },
    { name: '데스크탑', path: path.join(home, 'Desktop') },
    { name: '동영상', path: path.join(home, 'Movies') },
    { name: '외장·볼륨', path: '/Volumes' },
    { name: '홈', path: home },
  ].filter((c) => existing(c.path));
}

function buildRoots() {
  const seen = new Set();
  const roots = [];
  for (const r of rawRoots()) {
    if (!r || !r.path) continue;
    const abs = path.resolve(expandHome(String(r.path)));
    // The id is also the display name and the first path segment, so it must be
    // unique and must not contain a path separator.
    let id = String(r.name || path.basename(abs) || 'root').replace(/[/\\]/g, '-').trim() || 'root';
    let unique = id;
    let n = 2;
    while (seen.has(unique)) unique = `${id} (${n++})`;
    seen.add(unique);
    roots.push({ id: unique, name: unique, path: abs });
  }
  return roots;
}

export const ROOTS = buildRoots();
export const ROOT_BY_ID = new Map(ROOTS.map((r) => [r.id, r]));

export const CACHE_DIR = path.resolve(
  process.env.CACHE_DIR || path.join(__dirname, '..', 'cache'),
);

export const WEB_DIR = path.resolve(
  process.env.WEB_DIR || path.join(__dirname, '..', '..', 'app', 'dist'),
);

export const THUMB_WIDTHS = [200, 300, 400, 600];
export const VIEW_WIDTHS = [1280, 2000, 2560];

export const THUMB_QUALITY = Number(process.env.THUMB_QUALITY) || 72;
export const VIEW_QUALITY = Number(process.env.VIEW_QUALITY) || 84;

export const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
  '.tif', '.tiff', '.heic', '.heif', '.avif',
]);
