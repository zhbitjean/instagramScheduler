import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.POSTFLOW_LOCAL_PORT || 3030);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.mp4', '.mov']);
let mediaRoot = process.env.POSTFLOW_MEDIA_ROOT ? resolve(process.env.POSTFLOW_MEDIA_ROOT) : '';
let doneRoot = process.env.POSTFLOW_DONE_ROOT ? resolve(process.env.POSTFLOW_DONE_ROOT) : '';
const instagramAppId = process.env.INSTAGRAM_APP_ID || '';
const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET || '';
const instagramRedirectUri = process.env.INSTAGRAM_REDIRECT_URI || `http://127.0.0.1:${PORT}/instagram/callback`;
let instagramAccount = null;

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

    if (request.method === 'GET' && url.pathname === '/instagram/status') {
      return json(response, 200, { configured: Boolean(instagramAppId && instagramAppSecret), connected: Boolean(instagramAccount), account: instagramAccount && { id: instagramAccount.id, username: instagramAccount.username } });
    }

    if (request.method === 'GET' && url.pathname === '/instagram/connect') {
      if (!instagramAppId || !instagramAppSecret) return json(response, 400, { error: 'Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET before connecting.' });
      const authorize = new URL('https://www.instagram.com/oauth/authorize');
      authorize.searchParams.set('enable_fb_login', '0');
      authorize.searchParams.set('force_authentication', '1');
      authorize.searchParams.set('client_id', instagramAppId);
      authorize.searchParams.set('redirect_uri', instagramRedirectUri);
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
      response.writeHead(302, { location: authorize.toString() });
      return response.end();
    }

    if (request.method === 'GET' && url.pathname === '/instagram/callback') {
      const code = url.searchParams.get('code');
      if (!code) return json(response, 400, { error: url.searchParams.get('error_description') || 'Instagram did not return an authorization code.' });
      const form = new URLSearchParams({ client_id: instagramAppId, client_secret: instagramAppSecret, grant_type: 'authorization_code', redirect_uri: instagramRedirectUri, code });
      const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok) return json(response, 502, { error: token.error_message || 'Instagram token exchange failed.' });
      const profileResponse = await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(token.access_token)}`);
      const profile = await profileResponse.json();
      if (!profileResponse.ok) return json(response, 502, { error: profile.error?.message || 'Could not load the Instagram profile.' });
      instagramAccount = { id: String(profile.user_id || profile.id), username: profile.username, accessToken: token.access_token };
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return response.end('<!doctype html><meta charset="utf-8"><title>Instagram connected</title><style>body{font:16px system-ui;background:#f8f6ff;color:#201d2c;display:grid;place-items:center;min-height:100vh;margin:0}.card{background:white;padding:32px;border-radius:24px;box-shadow:0 20px 60px #2d23501a;text-align:center}</style><div class="card"><h1>Instagram connected</h1><p>You can close this window and return to Postflow.</p></div>');
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

    if (request.method === 'POST' && url.pathname === '/pick-folder') {
      if (process.platform !== 'win32') return json(response, 400, { error: 'The native folder picker is currently available on Windows.' });
      try {
        const script = `$shell = New-Object -ComObject Shell.Application; $folder = $shell.BrowseForFolder(0, 'Choose a folder for Postflow', 0, 0); if ($null -ne $folder) { [Console]::Out.Write($folder.Self.Path) }`;
        const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true });
        const path = stdout.trim();
        if (!path) return json(response, 200, { cancelled: true });
        const info = await stat(path);
        if (!info.isDirectory()) return json(response, 400, { error: 'The selected path is not a folder.' });
        return json(response, 200, { path: resolve(path) });
      } catch {
        return json(response, 500, { error: 'Windows could not open the folder chooser. Please type or paste the folder path instead.' });
      }
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
