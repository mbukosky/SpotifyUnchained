import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { encodeBody, sendEncoded } from './encodedResponse.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Vite names everything under /assets/ by content hash, so a URL there never
// changes meaning and browsers may keep it for a year without asking again.
export const cacheControlFor = urlPath => (urlPath.startsWith('/assets/')
  ? 'public, max-age=31536000, immutable'
  : 'public, max-age=0');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * Serves the built client's text files (HTML, JS, CSS, SVG) from memory,
 * compressed once with Brotli 11 and gzip 9 at startup instead of with
 * Brotli 4 on every request. Anything else (fonts, images, files added after
 * startup) falls through to the next handler, normally `express.static`.
 *
 * `ready` resolves once every file is encoded; until then requests fall
 * through as well.
 */
export function precompressedStatic(root) {
  const files = new Map(); // URL path → encoded entry

  const ready = (async () => {
    let paths;
    try {
      paths = await walk(root);
    } catch {
      return files; // no build yet (tests, dev): nothing to serve
    }
    await Promise.all(paths.map(async file => {
      const type = TYPES[path.extname(file).toLowerCase()];
      if (!type) return;
      const urlPath = `/${path.relative(root, file).split(path.sep).join('/')}`;
      files.set(urlPath, await encodeBody(await readFile(file), type));
    }));
    return files;
  })();

  const lookup = urlPath => files.get(urlPath === '/' ? '/index.html' : urlPath);

  function middleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const entry = lookup(req.path);
    if (!entry) return next();
    sendEncoded(req, res, entry, { cacheControl: cacheControlFor(req.path === '/' ? '/index.html' : req.path) });
  }

  /** Send the SPA shell (index.html), or fall through when it is not loaded. */
  function sendShell(req, res, next) {
    const entry = lookup('/index.html');
    if (!entry) return next();
    sendEncoded(req, res, entry, { cacheControl: cacheControlFor('/index.html') });
  }

  return { middleware, sendShell, ready };
}
