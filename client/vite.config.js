import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Put the app's stylesheet into index.html as a <style> element. It is ~9 kB
// compressed and blocks the first paint, so as its own file it cost a round
// trip before anything showed (Lighthouse put that at ~150 ms on mobile). The
// trade: the CSS now comes with every HTML load instead of from the cache.
function inlineCss() {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = bundle['index.html'];
      if (!html) return;
      for (const [name, asset] of Object.entries(bundle)) {
        if (!name.endsWith('.css') || asset.type !== 'asset') continue;
        const link = new RegExp(`<link rel="stylesheet"[^>]*href="/${name.replace(/[.]/g, '\\.')}"[^>]*>`);
        const css = String(asset.source);
        if (!link.test(html.source) || css.includes('</style')) continue;
        html.source = html.source.replace(link, () => `<style>${css}</style>`);
        delete bundle[name];
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  return {
    plugins: [react(), inlineCss()],
    root: '.',
    build: {
      outDir: 'dist',
      // Never inline fonts: a data URL is repeated in every @font-face that uses it.
      assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    },
    server: {
      host: '127.0.0.1',
      port: 4200,
      proxy: {
        '/spotify': 'http://localhost:3000',
        '/api': 'http://localhost:3000',
        '/rss': 'http://localhost:3000',
      },
    },
    define: {
      'import.meta.env.VITE_SPOTIFY_CLIENT_ID': JSON.stringify(env.SPOTIFY_CLIENT_ID || ''),
    },
  };
});
