import { atomflowRoute } from './image-transport';
import type { ImageConfig, ImageReference } from './generation';

interface JobStatus {
  status?: 'queued' | 'preparing' | 'generating' | 'retrying' | 'succeeded' | 'failed';
  result?: string;
  error?: { message?: string; detail?: string; status?: number };
}

function jobApiBase(value: string): string {
  const url = new URL(value.trim(), location.origin);
  if (url.origin !== location.origin || url.username || url.password || url.search || url.hash)
    throw Error('invalidJobApi');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function safeDetail(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').slice(0, 350) : '';
}

export async function generateWithJobApi(
  apiUrl: string,
  config: ImageConfig,
  endpoint: string,
  references: ImageReference[],
  prompt: string,
  signal: AbortSignal,
): Promise<string | null> {
  const route = atomflowRoute(endpoint);
  if (!route || !apiUrl.trim()) return null;

  const base = jobApiBase(apiUrl);
  const form = new FormData();
  const manifest: Array<
    | { type: 'url'; url: string; kind: string; id: string }
    | { type: 'upload'; field: string; kind: string; id: string }
  > = [];
  form.set('route', route);
  form.set('model', config.model);
  form.set('prompt', prompt.trim());
  form.set('size', config.size);
  form.set('quality', config.quality);

  references.forEach((reference, index) => {
    if ('file' in reference) {
      const field = `upload-${index}`;
      manifest.push({ type: 'upload', field, kind: reference.kind, id: reference.variant.id });
      form.set(field, reference.file, `${reference.kind}-upload`);
    } else {
      manifest.push({
        type: 'url',
        url: new URL(reference.variant.original, location.href).href,
        kind: reference.kind,
        id: reference.variant.id,
      });
    }
  });
  form.set('references', JSON.stringify(manifest));

  const submitted = await fetch(`${base}/jobs`, {
    method: 'POST',
    signal,
    credentials: 'omit',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  });
  const submission = await submitted.json().catch(() => null);
  if (!submitted.ok) {
    const detail = safeDetail(submission?.error?.detail || submission?.error?.message);
    throw Object.assign(new Error(detail), { jobStatus: submitted.status });
  }
  const jobId = typeof submission?.jobId === 'string' ? submission.jobId : '';
  const jobToken = typeof submission?.jobToken === 'string' ? submission.jobToken : '';
  if (!jobId || !jobToken) throw Error('invalidJobResponse');

  const cancel = () => {
    void fetch(`${base}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
      credentials: 'omit',
      headers: { 'X-Job-Token': jobToken },
      keepalive: true,
    }).catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      await delay(1_500, signal);
      const response = await fetch(`${base}/jobs/${encodeURIComponent(jobId)}`, {
        signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'X-Job-Token': jobToken },
      });
      const job = (await response.json().catch(() => null)) as JobStatus | null;
      if (!response.ok) {
        const detail = safeDetail(job?.error?.detail || job?.error?.message);
        throw Object.assign(new Error(detail), { jobStatus: response.status });
      }
      if (job?.status === 'succeeded' && typeof job.result === 'string') return job.result;
      if (job?.status === 'failed') {
        const detail = safeDetail(job.error?.detail || job.error?.message);
        throw Object.assign(new Error(detail), { jobStatus: job.error?.status || 502 });
      }
    }
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
