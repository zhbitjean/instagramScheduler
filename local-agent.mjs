import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';

const PORT = Number(process.env.POSTFLOW_LOCAL_PORT || 3030);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.mp4', '.mov']);
let mediaRoot = process.env.POSTFLOW_MEDIA_ROOT ? resolve(process.env.POSTFLOW_MEDIA_ROOT) : '';
let doneRoot = process.env.POSTFLOW_DONE_ROOT ? resolve(process.env.POSTFLOW_DONE_ROOT) : '';

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': 'http://localhost:3000',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  response.end(JSON.stringify(body));
}

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function safePart(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'instagram';
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return json(response, 204, {});
    const url = new URL(request.url || '/', `http://127.0.0.1:${PORT}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json(response, 200, { ok: true, mediaRoot, doneRoot: doneRoot || (mediaRoot ? join(mediaRoot, 'DONE') : '') });
    }

    if (request.method === 'POST' && url.pathname === '/configure') {
      const body = await readBody(request);
      const nextMediaRoot = resolve(String(body.mediaRoot || ''));
      const nextDoneRoot = resolve(String(body.doneRoot || join(nextMediaRoot, 'DONE')));
      const info = await stat(nextMediaRoot);
      if (!info.isDirectory()) return json(response, 400, { error: 'The source path is not a folder.' });
      if (!inside(nextMediaRoot, nextDoneRoot)) return json(response, 400, { error: 'DONE must be inside the source folder.' });
      mediaRoot = nextMediaRoot;
      doneRoot = nextDoneRoot;
      await mkdir(doneRoot, { recursive: true });
      return json(response, 200, { ok: true, mediaRoot, doneRoot });
    }

    if (request.method === 'GET' && url.pathname === '/scan') {
      if (!mediaRoot) return json(response, 400, { error: 'Choose a source folder first.' });
      const entries = await readdir(mediaRoot, { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile() && allowedExtensions.has(extname(entry.name).toLowerCase())).map((entry, index) => ({
        id: `local-${index}-${entry.name}`,
        name: entry.name,
        path: join(mediaRoot, entry.name),
        type: ['.mp4', '.mov'].includes(extname(entry.name).toLowerCase()) ? 'Video' : 'Photo',
        src: `http://127.0.0.1:${PORT}/media?name=${encodeURIComponent(entry.name)}`,
      }));
      return json(response, 200, { files, mediaRoot, doneRoot });
    }

    if (request.method === 'GET' && url.pathname === '/media') {
      if (!mediaRoot) return json(response, 400, { error: 'Not configured.' });
      const file = resolve(mediaRoot, basename(url.searchParams.get('name') || ''));
      if (!inside(mediaRoot, file) || !allowedExtensions.has(extname(file).toLowerCase())) return json(response, 403, { error: 'Not allowed.' });
      response.writeHead(200, {
        'content-type': ['.mp4', '.mov'].includes(extname(file).toLowerCase()) ? 'video/mp4' : 'image/jpeg',
        'access-control-allow-origin': 'http://localhost:3000',
        'cache-control': 'no-store',
      });
      return createReadStream(file).pipe(response);
    }

    if (request.method === 'POST' && url.pathname === '/archive-after-publish') {
      if (!mediaRoot) return json(response, 400, { error: 'Not configured.' });
      const body = await readBody(request);
      if (body.publishStatus !== 'published') return json(response, 409, { error: 'File was not moved because Instagram publishing did not succeed.' });
      const source = resolve(String(body.sourcePath || ''));
      if (!inside(mediaRoot, source) || resolve(source) === resolve(doneRoot)) return json(response, 403, { error: 'Source file is outside the configured folder.' });
      await mkdir(doneRoot || join(mediaRoot, 'DONE'), { recursive: true });
      const date = new Date(body.scheduledAt || Date.now());
      const stamp = date.toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 13);
      const sequence = String(Number(body.sequence || 1)).padStart(3, '0');
      const extension = extname(source).toLowerCase();
      const original = basename(source, extname(source)).replace(/[^a-zA-Z0-9_-]+/g, '-');
      const renamed = `${stamp}_${safePart(body.account)}_${sequence}_${original}${extension}`;
      const destination = join(doneRoot || join(mediaRoot, 'DONE'), renamed);
      await rename(source, destination);
      return json(response, 200, { ok: true, destination, renamed });
    }

    return json(response, 404, { error: 'Not found.' });
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : 'Unexpected local service error.' });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Postflow local folder service: http://127.0.0.1:${PORT}`);
});
