import os from 'node:os';
import { statfs, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const volume = fileURLToPath(new URL('../', import.meta.url));
const timestamp = () => new Date().toISOString();
const runFile = promisify(execFile);
const windowsHelper = fileURLToPath(new URL('./pc-windows-status.ps1', import.meta.url));
const windowsUnknown = reason => ({status:'unknown',reason,attemptedAt:timestamp()});
const windowsReasons = {
  ACCESS_DENIED: '일반 사용자 권한으로 읽을 수 없습니다. 권한이나 보안 설정은 변경하지 않았습니다.',
  READ_FAILED: 'Windows 조회를 완료하지 못했습니다. 필요한 서비스·명령·권한을 확인할 수 없습니다.',
  ADMIN_CONTEXT_REJECTED: '관리자 실행 환경에서는 조회하지 않습니다. 일반 PowerShell에서 실행하세요.',
};
function safeWindowsPart(part) {
  if (part?.status === 'ok') return part;
  return {status:'unknown',reason:windowsReasons[part?.reason] ?? 'Windows 조회 결과를 확인할 수 없습니다.',
    attemptedAt:part?.attemptedAt ?? timestamp()};
}
export async function readWindowsStatus({
  platform = process.platform,
  run = () => runFile('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    ['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',windowsHelper],
    {windowsHide:true,encoding:'utf8',timeout:40000,maxBuffer:512*1024}),
} = {}) {
  const unknownAll = reason => ({source:'actual',network:windowsUnknown(reason),firewall:windowsUnknown(reason),events:windowsUnknown(reason)});
  if (platform !== 'win32') return unknownAll('Windows 전용 조회입니다. 이 환경에서는 확인할 수 없습니다.');
  try {
    const {stdout} = await run();
    const data = JSON.parse(stdout.replace(/^\uFEFF/, ''));
    if (data?.source !== 'actual') throw Error('INVALID_RESULT');
    const events = safeWindowsPart(data.events);
    if (events.status === 'ok') events.logs = (events.logs ?? []).map(log => ({...safeWindowsPart(log),name:log.name}));
    return {source:'actual',network:safeWindowsPart(data.network),firewall:safeWindowsPart(data.firewall),events};
  } catch (error) {
    return unknownAll(error.killed ? 'Windows 조회 시간이 초과됐습니다. 권한 변경 없이 직접 다시 조회하세요.' : 'Windows 조회 프로세스의 결과를 읽지 못했습니다. 예시 값으로 대체하지 않습니다.');
  }
}
export async function readSdpStatus({ request = fetch } = {}) {
  try {
    const response = await request('http://127.0.0.1:5189/api/diagnostics', {signal:AbortSignal.timeout(3000),redirect:'error'});
    if (!response.ok) throw Error('SDP_DIAGNOSTICS_FAILED');
    const result = await response.json();
    const checkedAt = timestamp();
    if (result.ok === true && result.data?.engine?.mode === 'disconnected') {
      return {status:'disconnected',checkedAt,message:'SDP 미연결',reason:'기존 보안 앱의 엔진 진단이 disconnected입니다. PC 조회 성공과 별개입니다.'};
    }
    return {status:'unknown',checkedAt,message:'SDP 연결 확인 불가',reason:'진단 응답만으로 실제 SDP 서버 연결을 인증할 수 없습니다.'};
  } catch {
    return {...windowsUnknown('기존 보안 앱(5189)의 연결 진단 응답을 읽지 못했습니다. PC 조회 성공으로 SDP 연결을 판단하지 않습니다.'),message:'SDP 연결 확인 불가'};
  }
}
const failure = (unit, error) => ({
  status: 'unknown', unit, attemptedAt: timestamp(),
  reason: ['EACCES', 'EPERM'].includes(error?.code)
    ? '일반 권한으로 읽을 수 없습니다. 권한을 올리지 않고 확인 불가로 남깁니다.'
    : ['ENOSYS', 'ENOTSUP'].includes(error?.code)
      ? '이 환경에서 측정 API를 지원하지 않습니다.' : 'OS가 유효한 측정값을 제공하지 않았습니다.',
});
const cpuSnapshot = () => {
  const cpus = os.cpus();
  if (!cpus.length) throw Error('CPU_UNAVAILABLE');
  return cpus.reduce((sum, cpu) => ({
    idle: sum.idle + cpu.times.idle,
    total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0),
  }), { idle: 0, total: 0 });
};

// Read-only OS APIs. No elevated commands, external requests or saved history.
export async function measurePcStatus({
  cpu = cpuSnapshot,
  memory = () => ({ total: os.totalmem(), free: os.freemem() }),
  disk = () => statfs(volume),
  wait = () => new Promise(resolve => setTimeout(resolve, 1000)),
} = {}) {
  const result = { source: 'actual', cpu: null, memory: null, disk: null };
  try {
    const startedAt = timestamp(), start = performance.now(), before = cpu();
    await wait();
    const after = cpu(), total = after.total - before.total, idle = after.idle - before.idle;
    if (!Number.isFinite(total) || !Number.isFinite(idle) || total <= 0 || idle < 0 || idle > total) throw Error('CPU_INVALID');
    result.cpu = { status: 'ok', value: (1 - idle / total) * 100, unit: '%',
      startedAt, measuredAt: timestamp(), windowMs: Math.round(performance.now() - start) };
  } catch (error) { result.cpu = failure('%', error); }
  try {
    const { total, free } = memory();
    if (!Number.isFinite(total) || !Number.isFinite(free) || total <= 0 || free < 0 || free > total) throw Error('MEMORY_INVALID');
    result.memory = { status: 'ok', value: (total - free) / 2 ** 30, totalGiB: total / 2 ** 30,
      percent: (total - free) / total * 100, unit: 'GiB', measuredAt: timestamp() };
  } catch (error) { result.memory = failure('GiB', error); }
  try {
    const fs = await disk(), available = fs.bavail * fs.bsize;
    if (!Number.isFinite(available) || available < 0 || !Number.isFinite(fs.bsize) || fs.bsize <= 0) throw Error('DISK_INVALID');
    result.disk = { status: 'ok', value: available / 2 ** 30, unit: 'GiB', measuredAt: timestamp() };
  } catch (error) { result.disk = failure('GiB', error); }
  return result;
}

export function createPcStatusServer({ measure = measurePcStatus, windows = readWindowsStatus, sdp = readSdpStatus } = {}) {
  let busy = false;
  let windowsBusy = false;
  return createServer(async (req, res) => {
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store',
        'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
    };
    const port = req.socket.localPort;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site'
        || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) {
      send(403, { message: '이 로컬 화면과 같은 출처에서만 조회할 수 있습니다.' }); return;
    }
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); send(405, { message: '조회만 지원합니다.' }); return; }
    if (req.url === '/' || req.url === '/index.html') {
      try { send(200, await readFile(new URL('./pc-status.html', import.meta.url), 'utf8'), 'text/html; charset=utf-8'); }
      catch { send(503, { message: '학생 화면 파일을 읽을 수 없습니다.' }); }
      return;
    }
    if (req.url === '/api/windows-status') {
      if (windowsBusy) { send(429, {message:'Windows 조회 중입니다. 끝난 뒤 직접 다시 누르세요.'}); return; }
      windowsBusy = true;
      try {
        const [pcResult, sdpResult] = await Promise.allSettled([windows(),sdp()]);
        const pc = pcResult.status === 'fulfilled' ? pcResult.value : {source:'actual',network:windowsUnknown('Windows 조회 실패'),firewall:windowsUnknown('Windows 조회 실패'),events:windowsUnknown('Windows 조회 실패')};
        send(200, {...pc,sdp:sdpResult.status === 'fulfilled' ? sdpResult.value : {...windowsUnknown('SDP 진단 조회 실패'),message:'SDP 연결 확인 불가'}});
      } finally { windowsBusy = false; }
      return;
    }
    if (req.url !== '/api/measure') { send(404, { message: '지원하지 않는 주소입니다.' }); return; }
    if (busy) { send(429, { message: '이미 측정 중입니다. 끝난 뒤 직접 다시 누르세요.' }); return; }
    busy = true;
    try { send(200, await measure()); }
    catch { send(503, { message: '측정 결과를 읽지 못했습니다. 이전 값을 현재 값으로 사용하지 않습니다.' }); }
    finally { busy = false; }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const port = args.length === 0 ? 5191 : args.length === 2 && args[0] === '--port' && /^\d+$/.test(args[1]) ? Number(args[1]) : NaN;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    console.error('사용법: node student/pc-status-server.mjs [--port 5191]'); process.exitCode = 1;
  } else {
    const server = createPcStatusServer();
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? '포트가 사용 중입니다. 다른 프로그램을 종료하지 말고 --port로 다른 번호를 선택하세요.' : '로컬 화면을 시작하지 못했습니다.');
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`크립테아 내 PC 상태: http://127.0.0.1:${port}/ · 일반 권한 · 실제 측정 · Ctrl+C로 종료`));
  }
}
