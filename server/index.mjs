import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import sharp from 'sharp';

const PORT = Number(process.env.PORT || 8788);
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;
const MAX_REMOTE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCES = 8;
const MAX_QUEUE = Number(process.env.MAX_QUEUE || 100);
const CONCURRENCY = Number(process.env.JOB_CONCURRENCY || 2);
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS || 60 * 60 * 1000);
const RETRY_STATUSES = new Set([502, 503, 524]);
const UPSTREAMS = {
  site: 'https://atomflow.vip/v1/images/edits',
  api: 'https://api.atomflow.vip/v1/images/edits',
};
const REFERENCE_HOSTS = new Set(
  (
    process.env.REFERENCE_HOSTS ||
    'ai-pose-gallery.pages.dev,ai-pose-depth-gallery.pages.dev,ai-costume-gallery.pages.dev,ai-costume-anime-gallery.pages.dev,ai-portrait-gallery.pages.dev,omilic.com,www.omilic.com'
  )
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

const jobs = new Map();
const queue = [];
let activeJobs = 0;

class ApiError extends Error {
  constructor(status, code, detail = '') {
    super(detail || code);
    this.status = status;
    this.code = code;
    this.detail = cleanDetail(detail);
  }
}

function cleanDetail(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').slice(0, 350) : '';
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(body);
}

async function readRequest(request) {
  const declared = Number(request.headers['content-length'] || 0);
  if (declared && (!Number.isSafeInteger(declared) || declared > MAX_REQUEST_BYTES))
    throw new ApiError(413, 'request_too_large');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) throw new ApiError(413, 'request_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function textField(form, name, maxLength) {
  const value = form.get(name);
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw new ApiError(400, 'invalid_request', `Invalid ${name}`);
  return value.trim();
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest();
}

function authorized(job, token = '') {
  const supplied = tokenHash(token);
  return supplied.length === job.tokenHash.length && timingSafeEqual(supplied, job.tokenHash);
}

function jobPayload(job) {
  const payload = {
    jobId: job.id,
    status: job.status,
    attempt: job.attempt,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
  if (job.status === 'succeeded') payload.result = job.result;
  if (job.status === 'failed') payload.error = job.error;
  return payload;
}

async function remoteBuffer(urlValue, signal) {
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new ApiError(400, 'invalid_reference_url');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !REFERENCE_HOSTS.has(url.hostname.toLowerCase())
  )
    throw new ApiError(400, 'reference_host_not_allowed');

  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    redirect: 'error',
    headers: { Accept: 'image/png,image/jpeg,image/webp' },
  }).catch(() => {
    throw new ApiError(502, 'reference_unavailable');
  });
  if (!response.ok) throw new ApiError(502, 'reference_unavailable', `HTTP ${response.status}`);
  const declared = Number(response.headers.get('Content-Length') || 0);
  if (declared > MAX_REMOTE_BYTES) throw new ApiError(413, 'reference_too_large');
  if (!response.body) throw new ApiError(502, 'reference_unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REMOTE_BYTES) {
      await reader.cancel();
      throw new ApiError(413, 'reference_too_large');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function normalizeImage(input) {
  try {
    const image = sharp(input, { animated: false, limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height)
      throw new Error('unsupported');
    return await image
      .rotate()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92, effort: 4, smartSubsample: true })
      .toBuffer();
  } catch {
    throw new ApiError(400, 'invalid_reference_image');
  }
}

async function prepareReferences(job) {
  const output = [];
  for (const reference of job.references) {
    if (job.controller.signal.aborted) throw new ApiError(499, 'cancelled');
    const input =
      reference.type === 'url'
        ? await remoteBuffer(reference.url, job.controller.signal)
        : reference.buffer;
    output.push(await normalizeImage(input));
  }
  return output;
}

function resultFromPayload(payload) {
  const row = payload?.data?.[0];
  if (typeof row?.b64_json === 'string') {
    if (
      row.b64_json.length > 100_000_000 ||
      row.b64_json.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(row.b64_json)
    )
      throw new ApiError(502, 'invalid_provider_result');
    const bytes = Buffer.from(row.b64_json, 'base64');
    const mime = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      ? 'image/png'
      : bytes[0] === 0xff && bytes[1] === 0xd8
        ? 'image/jpeg'
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
          ? 'image/webp'
          : '';
    if (!mime) throw new ApiError(502, 'invalid_provider_result');
    return `data:${mime};base64,${row.b64_json}`;
  }
  if (typeof row?.url === 'string') {
    const url = new URL(row.url);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  }
  throw new ApiError(502, 'invalid_provider_result');
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new ApiError(499, 'cancelled'));
      },
      { once: true },
    );
  });
}

async function callProvider(job, images) {
  const upstream = UPSTREAMS[job.route];
  for (let attempt = 1; attempt <= 3; attempt++) {
    job.attempt = attempt;
    job.status = attempt === 1 ? 'generating' : 'retrying';
    job.updatedAt = Date.now();
    const form = new FormData();
    form.set('model', job.model);
    form.set('prompt', job.prompt);
    form.set('n', '1');
    form.set('size', job.size);
    form.set('quality', job.quality);
    images.forEach((image, index) =>
      form.append(
        'image[]',
        new Blob([image], { type: 'image/webp' }),
        `reference-${index + 1}.webp`,
      ),
    );

    let response;
    try {
      response = await fetch(upstream, {
        method: 'POST',
        signal: AbortSignal.any([job.controller.signal, AbortSignal.timeout(180_000)]),
        redirect: 'error',
        headers: { Authorization: `Bearer ${job.apiKey}`, Accept: 'application/json' },
        body: form,
      });
    } catch {
      response = { ok: false, status: 502, json: async () => null };
    }
    const payload = await response.json().catch(() => null);
    if (response.ok && !payload?.error) return resultFromPayload(payload);
    const status = Number(response.status) || 502;
    const detail = cleanDetail(payload?.error?.message || `HTTP ${status}`);
    if (!RETRY_STATUSES.has(status) || attempt === 3)
      throw new ApiError(status, 'provider_failed', detail);
    await wait(1_500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500), job.controller.signal);
  }
  throw new ApiError(502, 'provider_failed');
}

async function runJob(job) {
  try {
    job.status = 'preparing';
    job.updatedAt = Date.now();
    const images = await prepareReferences(job);
    job.result = await callProvider(job, images);
    job.status = 'succeeded';
  } catch (error) {
    if (job.controller.signal.aborted) {
      job.status = 'failed';
      job.error = { message: 'cancelled', status: 499 };
    } else {
      const failure = error instanceof ApiError ? error : new ApiError(502, 'internal_error');
      job.status = 'failed';
      job.error = {
        message: failure.code,
        detail: failure.detail,
        status: failure.status,
      };
    }
  } finally {
    job.apiKey = '';
    job.references.forEach((reference) => {
      if (reference.type === 'upload') reference.buffer = Buffer.alloc(0);
    });
    job.updatedAt = Date.now();
    activeJobs--;
    drainQueue();
  }
}

function drainQueue() {
  while (activeJobs < CONCURRENCY && queue.length) {
    const job = queue.shift();
    if (!job || job.controller.signal.aborted) continue;
    activeJobs++;
    void runJob(job);
  }
}

async function submitJob(request, response) {
  if (queue.length + activeJobs >= MAX_QUEUE) throw new ApiError(503, 'queue_full');
  const auth = request.headers.authorization || '';
  if (!/^Bearer [^\r\n]{1,8192}$/.test(auth)) throw new ApiError(401, 'missing_authorization');
  const contentType = request.headers['content-type'] || '';
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType))
    throw new ApiError(415, 'multipart_required');
  const body = await readRequest(request);
  const webRequest = new Request('http://localhost/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });
  const form = await webRequest.formData().catch(() => {
    throw new ApiError(400, 'invalid_multipart');
  });
  const route = textField(form, 'route', 10);
  if (!(route in UPSTREAMS)) throw new ApiError(400, 'invalid_route');
  const model = textField(form, 'model', 100);
  const prompt = textField(form, 'prompt', 20_000);
  const size = textField(form, 'size', 30);
  const quality = textField(form, 'quality', 20);
  if (!['1024x1024', '1024x1536', '1536x1024', '2048x2048', 'auto'].includes(size))
    throw new ApiError(400, 'invalid_size');
  if (!['auto', 'low', 'medium', 'high'].includes(quality))
    throw new ApiError(400, 'invalid_quality');

  let manifest;
  try {
    manifest = JSON.parse(textField(form, 'references', 20_000));
  } catch {
    throw new ApiError(400, 'invalid_references');
  }
  if (!Array.isArray(manifest) || !manifest.length || manifest.length > MAX_REFERENCES)
    throw new ApiError(400, 'invalid_references');
  const references = [];
  for (const entry of manifest) {
    if (!entry || !['pose', 'costume', 'character'].includes(entry.kind))
      throw new ApiError(400, 'invalid_reference');
    if (entry.type === 'url' && typeof entry.url === 'string') {
      references.push({ type: 'url', url: entry.url, kind: entry.kind });
      continue;
    }
    if (entry.type === 'upload' && typeof entry.field === 'string') {
      const file = form.get(entry.field);
      if (!file || typeof file === 'string' || !file.size || file.size > MAX_UPLOAD_BYTES)
        throw new ApiError(400, 'invalid_upload');
      references.push({
        type: 'upload',
        buffer: Buffer.from(new Uint8Array(await file.arrayBuffer())),
        kind: entry.kind,
      });
      continue;
    }
    throw new ApiError(400, 'invalid_reference');
  }

  const id = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const job = {
    id,
    tokenHash: tokenHash(token),
    status: 'queued',
    attempt: 0,
    createdAt: now,
    updatedAt: now,
    apiKey: auth.slice(7),
    route,
    model,
    prompt,
    size,
    quality,
    references,
    controller: new AbortController(),
  };
  jobs.set(id, job);
  queue.push(job);
  drainQueue();
  json(response, 202, { jobId: id, jobToken: token, status: 'queued' });
}

function jobRoute(request, response, id) {
  const job = jobs.get(id);
  if (!job || !authorized(job, request.headers['x-job-token'] || ''))
    throw new ApiError(404, 'job_not_found');
  if (request.method === 'GET') return json(response, 200, jobPayload(job));
  if (request.method === 'DELETE') {
    job.controller.abort();
    job.status = 'failed';
    job.error = { message: 'cancelled', status: 499 };
    job.apiKey = '';
    job.updatedAt = Date.now();
    return json(response, 202, jobPayload(job));
  }
  throw new ApiError(405, 'method_not_allowed');
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (request.method === 'GET' && ['/healthz', '/api/healthz'].includes(url.pathname))
      return json(response, 200, { ok: true, queue: queue.length, active: activeJobs });
    if (request.method === 'POST' && url.pathname === '/api/jobs')
      return await submitJob(request, response);
    const match = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})$/i);
    if (match) return jobRoute(request, response, match[1]);
    throw new ApiError(404, 'not_found');
  } catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError(500, 'internal_error');
    json(response, failure.status, {
      error: { message: failure.code, ...(failure.detail ? { detail: failure.detail } : {}) },
    });
  }
});

server.requestTimeout = 45_000;
server.headersTimeout = 15_000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(JSON.stringify({ event: 'server_started', port: PORT }));
});

setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs)
    if (job.updatedAt < cutoff && ['succeeded', 'failed'].includes(job.status)) jobs.delete(id);
}, 60_000).unref();

for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => server.close(() => process.exit(0)));
