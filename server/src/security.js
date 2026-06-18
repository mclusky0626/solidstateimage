import path from 'node:path';
import { ROOT_BY_ID } from './config.js';

// Resolve a client path of the form "<rootId>/<relative>" to an absolute path.
// - ""            → home (list of roots)
// - "사진"         → that root's top directory
// - "사진/2024"    → a folder inside the root
// Throws 404 for an unknown root, 403 for path traversal outside the root.
export function resolvePath(clientPath = '') {
  const clean = String(clientPath).replace(/^[/\\]+/, '');
  if (!clean) return { home: true };

  const slash = clean.indexOf('/');
  const rootId = slash === -1 ? clean : clean.slice(0, slash);
  const rel = slash === -1 ? '' : clean.slice(slash + 1);

  const root = ROOT_BY_ID.get(rootId);
  if (!root) {
    const e = new Error('알 수 없는 루트입니다');
    e.status = 404;
    throw e;
  }

  const abs = path.resolve(root.path, rel);
  const rootSep = root.path.endsWith(path.sep) ? root.path : root.path + path.sep;
  if (abs !== root.path && !abs.startsWith(rootSep)) {
    const e = new Error('Path outside of root');
    e.status = 403;
    throw e;
  }
  return { home: false, rootId, root, abs };
}

// Absolute path → client path ("<rootId>/<relative>", or just "<rootId>" at top).
export function toClientPath(rootId, root, abs) {
  const rel = path.relative(root.path, abs).split(path.sep).join('/');
  return rel ? `${rootId}/${rel}` : rootId;
}
