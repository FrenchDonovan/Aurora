import { createServer } from 'node:http';
import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
if (!existsSync(root)) throw new Error('Build first: node scripts/build.mjs');
const canonicalRoot = realpathSync(root);
const portArgument = process.argv.find(value => value.startsWith('--port='));
const port = Number(portArgument?.split('=')[1] ?? process.env.PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const server = createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const candidate = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
    if (!candidate.startsWith(root + path.sep) || !existsSync(candidate) || !statSync(candidate).isFile()) { response.writeHead(404).end('Not found'); return; }
    const canonical = realpathSync(candidate);
    if (!canonical.startsWith(canonicalRoot + path.sep)) { response.writeHead(403).end(); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(candidate)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    if (request.method === 'HEAD') response.end(); else createReadStream(candidate).pipe(response);
  } catch { response.writeHead(400).end('Bad request'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Aurora preview: http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
