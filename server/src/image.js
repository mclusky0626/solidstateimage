import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import exifReader from 'exif-reader';

// Tune libvips: keep a small operation cache and spread work across cores.
sharp.cache({ items: 200, memory: 256 });
sharp.concurrency(Math.max(2, Math.min(os.cpus().length, 8)));

// Square, center-cropped thumbnail → a uniform, Apple-Photos-style grid.
export function makeThumb(absPath, width, quality) {
  return runSharp(absPath, (img) =>
    img
      .resize(width, width, { fit: 'cover', position: 'attention' })
      .webp({ quality, effort: 2 }),
  );
}

// Full-aspect image bounded to `width` on its longest side, for the viewer.
export function makeView(absPath, width, quality) {
  return runSharp(absPath, (img) =>
    img
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 3 }),
  );
}

// Read image metadata + a friendly subset of EXIF for the viewer info panel.
export async function readMeta(absPath) {
  let meta;
  try {
    meta = await sharp(absPath, { failOn: 'none', limitInputPixels: 0 }).metadata();
  } catch {
    // HEIC and a few exotic formats may not decode for metadata; that's fine —
    // the caller still has file size/mtime from fs.stat.
    return { width: null, height: null, format: null, exif: null };
  }

  // EXIF orientation 5–8 means the stored pixels are rotated 90°; swap W/H so the
  // reported dimensions match what the user actually sees.
  const swap = meta.orientation && meta.orientation >= 5;
  const width = swap ? meta.height : meta.width;
  const height = swap ? meta.width : meta.height;

  let exif = null;
  if (meta.exif) {
    try {
      const e = exifReader(meta.exif);
      const img = e.Image || {};
      const photo = e.Photo || {};
      const make = (img.Make || '').trim();
      const model = (img.Model || '').trim();
      const fnum = photo.FNumber;
      const exp = photo.ExposureTime;
      const focal = photo.FocalLength;
      const iso = Array.isArray(photo.ISOSpeedRatings)
        ? photo.ISOSpeedRatings[0]
        : photo.ISOSpeedRatings;
      const dt = photo.DateTimeOriginal || img.DateTime;
      exif = {
        camera: [make, model].filter(Boolean).join(' ') || null,
        lens: (photo.LensModel || '').trim() || null,
        dateTime: dt instanceof Date ? dt.toISOString() : dt || null,
        iso: iso || null,
        fNumber: typeof fnum === 'number' ? fnum : null,
        exposure:
          typeof exp === 'number'
            ? exp >= 1
              ? `${exp}s`
              : `1/${Math.round(1 / exp)}s`
            : null,
        focalLength: typeof focal === 'number' ? Math.round(focal) : null,
      };
      // Drop the object entirely if every field came back empty.
      if (!Object.values(exif).some((v) => v != null)) exif = null;
    } catch {
      exif = null;
    }
  }

  return { width, height, format: meta.format || null, exif };
}

async function runSharp(absPath, transform) {
  try {
    const img = sharp(absPath, { failOn: 'none', limitInputPixels: 0 }).rotate();
    return await transform(img).toBuffer();
  } catch (err) {
    // Fallback for formats the bundled libvips can't decode (notably HEIC/HEIF
    // from iPhones). macOS ships `sips`, which handles them natively.
    if (process.platform === 'darwin') {
      const tmp = await sipsToPng(absPath);
      try {
        const img = sharp(tmp, { failOn: 'none', limitInputPixels: 0 }).rotate();
        return await transform(img).toBuffer();
      } finally {
        fsp.unlink(tmp).catch(() => {});
      }
    }
    throw err;
  }
}

function sipsToPng(absPath) {
  return new Promise((resolve, reject) => {
    const out = path.join(
      os.tmpdir(),
      `ssi-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
    );
    const p = spawn('sips', ['-s', 'format', 'png', absPath, '--out', out]);
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error('sips failed: ' + code)),
    );
  });
}
