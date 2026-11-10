import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/**
 * A response body encoded once, ahead of the request that needs it: the plain
 * bytes, Brotli at its highest quality and gzip at level 9, plus a strong ETag.
 * Compressing at quality 11 costs a few milliseconds per body, which is why it
 * happens once per cache fill and not per request (the `compression`
 * middleware uses quality 4 to stay cheap on every request).
 */
export async function encodeBody(body, type = 'application/json; charset=utf-8') {
  const identity = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const [br, gz] = await Promise.all([
    brotli(identity, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: identity.length,
      },
    }),
    gzip(identity, { level: 9 }),
  ]);
  const etag = `"${createHash('sha1').update(identity).digest('base64url')}"`;
  return { type, etag, identity, br, gzip: gz };
}

export const encodeJson = value => encodeBody(JSON.stringify(value));

// q-values matter: "br;q=0" means no Brotli. Unlisted codings are not acceptable,
// except identity, which is acceptable unless refused explicitly.
function acceptable(header) {
  const accepted = new Map();
  for (const part of String(header || '').split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    if (!name) continue;
    const q = params.map(p => p.trim()).find(p => p.startsWith('q='));
    accepted.set(name, q ? Number(q.slice(2)) : 1);
  }
  const ok = name => (accepted.get(name) ?? accepted.get('*') ?? 0) > 0;
  return { br: ok('br'), gzip: ok('gzip') };
}

function matchesEtag(header, etag) {
  if (!header) return false;
  return header.split(',').some(tag => {
    const t = tag.trim();
    return t === '*' || t === etag || t === `W/${etag}`;
  });
}

/**
 * Send a pre-encoded body, picking Brotli, then gzip, then identity from the
 * request's Accept-Encoding, and answering 304 when If-None-Match matches.
 * The Content-Encoding header set here makes the `compression` middleware
 * leave the body alone.
 */
export function sendEncoded(req, res, entry, { cacheControl, status = 200 } = {}) {
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('ETag', entry.etag);
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);

  if (status === 200 && matchesEtag(req.headers['if-none-match'], entry.etag)) {
    res.status(304).end();
    return;
  }

  const accepts = acceptable(req.headers['accept-encoding']);
  let body = entry.identity;
  if (accepts.br) {
    body = entry.br;
    res.setHeader('Content-Encoding', 'br');
  } else if (accepts.gzip) {
    body = entry.gzip;
    res.setHeader('Content-Encoding', 'gzip');
  }
  res.status(status);
  res.setHeader('Content-Type', entry.type);
  res.setHeader('Content-Length', body.length);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

/**
 * A small bounded cache of encoded responses with a time to live. Map
 * insertion order doubles as least-recently-used order. Concurrent misses for
 * the same key share one fill.
 */
export class EncodedCache {
  constructor({ max = 100, ttlMs = 5 * 60 * 1000, now = Date.now } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.now = now;
    this.entries = new Map();
    this.pending = new Map();
    this.generation = 0;
  }

  get(key) {
    const hit = this.entries.get(key);
    if (!hit) return null;
    if (this.now() - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.entry;
  }

  set(key, entry) {
    this.entries.delete(key);
    this.entries.set(key, { entry, at: this.now() });
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value);
  }

  /**
   * The cached entry for `key`, or the result of `fill()` (stored unless it
   * resolves to null). A fill started before `clear()` is not stored.
   */
  async getOrFill(key, fill) {
    const hit = this.get(key);
    if (hit) return hit;
    if (this.pending.has(key)) return this.pending.get(key);
    const generation = this.generation;
    const job = (async () => {
      try {
        const entry = await fill();
        if (entry && generation === this.generation) this.set(key, entry);
        return entry;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, job);
    return job;
  }

  clear() {
    this.entries.clear();
    this.pending.clear();
    this.generation++;
  }

  get size() {
    return this.entries.size;
  }
}
