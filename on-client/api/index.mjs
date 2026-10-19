import { createOnServer } from '../src/server.mjs';

// Public preview only: no private adapters, AI credentials or security actions.
const server = createOnServer({ aiEnv: {} });
let ready;
const readable = new Set([
  '/', '/index.html', '/app.js', '/style.css', '/vulnerabilities-view.mjs',
  '/ai-connect.mjs', '/student/extension.mjs',
  '/api/me', '/api/apps', '/api/events', '/api/devices', '/api/sessions',
  '/api/diagnostics',
  ...['alekov-ai-explain', 'alekov-app-icon', 'alekov-connect-approval',
    'alekov-connection-unknown', 'alekov-empty-records']
    .map(name => `/assets/alekov/${name}.webp`),
]);

function respond(res, status, code, message) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify({ ok: false, error: { code, message, retryable: false },
    meta: { mode: 'disconnected' } }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return respond(res, 405, 'PREVIEW_READ_ONLY', '공개 미리보기에서는 조회만 지원합니다.');
  }
  if (!req.url?.startsWith('/') || req.url.startsWith('//')) {
    return respond(res, 400, 'REQUEST_INVALID', '지원하지 않는 요청입니다.');
  }
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { return respond(res, 400, 'REQUEST_INVALID', '지원하지 않는 요청입니다.'); }
  if (url.search) return respond(res, 400, 'QUERY_REJECTED', '지원하지 않는 요청입니다.');
  if (!readable.has(url.pathname)) {
    return respond(res, 404, 'NOT_FOUND', '공개 미리보기에서 지원하지 않는 주소입니다.');
  }

  // Keep the supplied server's loopback checks intact. No external port is opened.
  ready ??= new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      server.unref();
      resolve();
    });
  }).catch(error => { ready = undefined; throw error; });
  try { await ready; }
  catch { return respond(res, 503, 'PREVIEW_UNAVAILABLE', '미리보기를 시작하지 못했습니다.'); }

  // Only the allowlisted GET routes reach the disconnected local server.
  req.headers = { ...req.headers, host: `127.0.0.1:${server.address().port}` };
  await new Promise(resolve => {
    const done = () => {
      res.removeListener('finish', done);
      res.removeListener('close', done);
      resolve();
    };
    res.once('finish', done);
    res.once('close', done);
    server.emit('request', req, res);
  });
}
