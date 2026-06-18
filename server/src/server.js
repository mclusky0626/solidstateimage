import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  PORT, ROOTS, WEB_DIR,
  THUMB_WIDTHS, VIEW_WIDTHS, THUMB_QUALITY, VIEW_QUALITY, IMAGE_EXTENSIONS,
} from './config.js';
import { resolvePath, toClientPath } from './security.js';
import { cacheKey, cachePathFor, ensureDirFor, existsSync } from './cache.js';
import { makeThumb, makeView, readMeta } from './image.js';

const app = express();
app.use(cors());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, roots: ROOTS.map((r) => r.id) });
});

// --- Directory listing -----------------------------------------------------
app.get('/api/dir', async (req, res, next) => {
  try {
    const rel = req.query.path || '';
    const r = resolvePath(rel);

    // Home: list the configured roots as top-level folders.
    if (r.home) {
      res.json({
        path: '',
        name: '홈',
        parent: null,
        dirs: ROOTS.map((rt) => ({ name: rt.id, path: rt.id })),
        images: [],
      });
      return;
    }

    const entries = await fsp.readdir(r.abs, { withFileTypes: true });

    const dirs = [];
    const images = [];
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const childAbs = path.join(r.abs, e.name);
      if (e.isDirectory()) {
        dirs.push({ name: e.name, path: toClientPath(r.rootId, r.root, childAbs) });
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) continue;
        let stat;
        try { stat = await fsp.stat(childAbs); } catch { continue; }
        images.push({
          name: e.name,
          path: toClientPath(r.rootId, r.root, childAbs),
          size: stat.size,
          mtime: Math.floor(stat.mtimeMs),
        });
      }
    }

    const byName = (a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true });
    dirs.sort(byName);
    images.sort(byName);

    const atRoot = r.abs === r.root.path;
    res.json({
      path: toClientPath(r.rootId, r.root, r.abs),
      name: atRoot ? r.rootId : path.basename(r.abs),
      parent: atRoot ? '' : toClientPath(r.rootId, r.root, path.dirname(r.abs)),
      dirs,
      images,
    });
  } catch (err) { next(err); }
});

// --- Optimized image streaming (thumb / view) ------------------------------
function pickWidth(requested, whitelist, fallback) {
  const w = Number(requested);
  return whitelist.includes(w) ? w : fallback;
}

async function serveProcessed(req, res, kind, widths, defaultWidth, quality, maker) {
  const rel = req.query.path;
  if (!rel) { res.status(400).json({ error: 'path required' }); return; }

  const r = resolvePath(rel);
  if (r.home) { res.status(400).json({ error: 'path required' }); return; }
  const abs = r.abs;
  const ext = path.extname(abs).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) { res.status(415).json({ error: 'unsupported type' }); return; }

  let stat;
  try { stat = await fsp.stat(abs); } catch { res.status(404).json({ error: 'not found' }); return; }

  const width = pickWidth(req.query.w, widths, defaultWidth);
  const key = cacheKey([kind, abs, Math.floor(stat.mtimeMs), stat.size, width, quality, 'webp', 'v1']);
  const etag = `"${key}"`;

  // Conditional request: the client already has this exact version.
  if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }

  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('ETag', etag);

  const cp = cachePathFor(kind, key, 'webp');
  if (existsSync(cp)) {
    fs.createReadStream(cp).pipe(res);
    return;
  }

  // Cache miss: generate once, persist, then send.
  const buf = await maker(abs, width, quality);
  await ensureDirFor(cp);
  await fsp.writeFile(cp, buf).catch(() => {});
  res.end(buf);
}

app.get('/api/thumb', async (req, res, next) => {
  try { await serveProcessed(req, res, 'thumb', THUMB_WIDTHS, 400, THUMB_QUALITY, makeThumb); }
  catch (err) { next(err); }
});

app.get('/api/view', async (req, res, next) => {
  try { await serveProcessed(req, res, 'view', VIEW_WIDTHS, 2000, VIEW_QUALITY, makeView); }
  catch (err) { next(err); }
});

// --- Original file (full quality download / save) --------------------------
app.get('/api/raw', async (req, res, next) => {
  try {
    const r = resolvePath(req.query.path);
    if (r.home) { res.status(400).json({ error: 'path required' }); return; }
    const abs = r.abs;
    const ext = path.extname(abs).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) { res.status(415).json({ error: 'unsupported type' }); return; }
    if (!existsSync(abs)) { res.status(404).json({ error: 'not found' }); return; }
    res.sendFile(abs);
  } catch (err) { next(err); }
});

// --- Image metadata + EXIF (viewer info panel) -----------------------------
app.get('/api/meta', async (req, res, next) => {
  try {
    const r = resolvePath(req.query.path);
    if (r.home) { res.status(400).json({ error: 'path required' }); return; }
    const abs = r.abs;
    const ext = path.extname(abs).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) { res.status(415).json({ error: 'unsupported type' }); return; }

    let stat;
    try { stat = await fsp.stat(abs); } catch { res.status(404).json({ error: 'not found' }); return; }

    const meta = await readMeta(abs);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json({
      name: path.basename(abs),
      size: stat.size,
      mtime: Math.floor(stat.mtimeMs),
      width: meta.width,
      height: meta.height,
      format: meta.format,
      exif: meta.exif,
    });
  } catch (err) { next(err); }
});

// --- Serve the built web frontend (same-origin → no CORS, no mixed content) -
if (existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(WEB_DIR, 'index.html'));
  });
}

// --- Error handler ---------------------------------------------------------
app.use((err, req, res, _next) => {
  let status = err.status;
  if (!status) {
    if (err.code === 'ENOENT') status = 404;
    else if (err.code === 'EACCES' || err.code === 'EPERM') status = 403;
    else status = 500;
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'error' });
});

app.listen(PORT, () => {
  console.log(`SolidStateImage server → http://0.0.0.0:${PORT}`);
  console.log('  Roots:');
  for (const r of ROOTS) console.log(`    • ${r.id}  →  ${r.path}`);
});
