import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Build-only public shell inventory. Runtime API responses never enter this cache. */
export function offlineShell(): Plugin {
  return {
    name: 'aviation-offline-shell',
    apply: 'build',
    async writeBundle(options) {
      const root = resolve(options.dir ?? 'dist')
      async function files(directory: string, prefix = ''): Promise<string[]> {
        const result: string[] = []
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const name = prefix + entry.name
          if (entry.isDirectory())
            result.push(...(await files(resolve(directory, entry.name), name + '/')))
          else if (!name.endsWith('.map') && name !== 'offline-sw.js' && name !== 'env.js')
            result.push('/' + name)
        }
        return result.sort()
      }
      const paths = await files(root)
      const hashes: Record<string, string> = {}
      for (const path of paths)
        hashes[path] = createHash('sha256')
          .update(await readFile(resolve(root, '.' + path)))
          .digest('hex')
      const version = createHash('sha256').update(JSON.stringify(hashes) + offlineShell.toString()).digest('hex').slice(0, 20)
      const script = `
const CACHE = 'aviation-shell-${version}';
const ASSETS = ${JSON.stringify(hashes)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    for (const [path, expected] of Object.entries(ASSETS)) {
      const response = await fetch(new Request(path, {credentials:'omit',cache:'no-store',redirect:'error'}));
      if (!response.ok) throw new Error('Shell asset unavailable');
      const bytes = await response.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');
      if (hash !== expected) throw new Error('Shell asset changed during installation; reload and retry');
      if (path === '/index.html') {
        const html = new TextDecoder().decode(bytes).replace(/<script\\b[^>]*\\bsrc=["']https?:[^"']*["'][^>]*><\\/script>/gi, '');
        await cache.put(path, new Response(html, {headers:{'Content-Type':'text/html; charset=utf-8'}}));
      } else await cache.put(path, new Response(bytes, {headers:{'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream'}}));
    }
    await cache.put('/env.js', new Response('window.__ENV__ = {};', {headers:{'Content-Type':'text/javascript'}}));
  } catch(error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('aviation-shell-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/flight-plans')) return;
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/offline')) {
    event.respondWith(self.navigator.onLine ? fetch(request).catch(async () => (await caches.open(CACHE)).match('/index.html')) : caches.open(CACHE).then(cache => cache.match('/index.html')));
  } else if (!url.search && url.pathname === '/env.js') {
    event.respondWith(self.navigator.onLine ? fetch(request).catch(async () => (await caches.open(CACHE)).match('/env.js')) : caches.open(CACHE).then(cache => cache.match('/env.js')));
  } else if (!url.search && Object.hasOwn(ASSETS, url.pathname)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(url.pathname)) || fetch(request))());
  }
});
`
      await writeFile(resolve(root, 'offline-sw.js'), script)
    },
  }
}
