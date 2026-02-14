const path = require("path");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = Bun.serve({
  port: 4002,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const fullPath = path.join(import.meta.dir, filePath);
    const file = Bun.file(fullPath);
    const exists = await file.exists();
    if (!exists) return new Response("Not Found", { status: 404 });
    const ext = path.extname(filePath);
    return new Response(file, {
      headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" },
    });
  },
});

console.log(`V2 Vinyl Waveform server running at http://localhost:${server.port}`);
