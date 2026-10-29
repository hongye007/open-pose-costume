import type { Kind, Lang, Reference, Variant } from './types';

export interface ImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: string;
  quality: 'auto' | 'low' | 'medium' | 'high';
  rememberKey: boolean;
}
export interface ImageReference {
  kind: Kind;
  title: Reference['title'];
  keywords: Reference['keywords'];
  variant: Variant;
}
export interface GenerationJob {
  references: ImageReference[];
  prompt: string;
  status: 'loading' | 'error' | 'success';
  result?: string;
  error?: string;
}

const SETTINGS_KEY = 'opc-image-settings';
const SESSION_KEY = 'opc-image-session-key';
export const defaultImageConfig: ImageConfig = {
  baseUrl: 'https://atomflow.vip',
  apiKey: '',
  model: 'gpt-image-2',
  size: '1024x1536',
  quality: 'auto',
  rememberKey: false,
};
export const imageSizes = ['1024x1024', '1024x1536', '1536x1024', '2048x2048', 'auto'];

export function imageEndpoint(baseUrl: string): string {
  const url = new URL(baseUrl.trim());
  const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw Error('invalidEndpoint');
  let pathname = url.pathname.replace(/\/+$/, '').replace(/\/images\/(edits|generations)$/, '');
  if (!pathname.endsWith('/v1')) pathname += '/v1';
  return `${url.origin}${pathname}/images/edits`;
}

export function normalizeImageConfig(config: ImageConfig): ImageConfig {
  const endpoint = imageEndpoint(config.baseUrl);
  if (!config.apiKey.trim() || !config.model.trim() || /[\r\n]/.test(config.apiKey))
    throw Error('missingConfig');
  if (
    !imageSizes.includes(config.size) ||
    !['auto', 'low', 'medium', 'high'].includes(config.quality)
  )
    throw Error('invalidConfig');
  return {
    ...config,
    baseUrl: endpoint.replace(/\/images\/edits$/, ''),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  };
}

export function loadImageConfig(): ImageConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved || typeof saved.baseUrl !== 'string' || typeof saved.model !== 'string')
      return { ...defaultImageConfig };
    const rememberKey = saved.rememberKey === true;
    const apiKey = rememberKey ? saved.apiKey : sessionStorage.getItem(SESSION_KEY);
    const candidate = {
      ...defaultImageConfig,
      ...saved,
      rememberKey,
      apiKey: typeof apiKey === 'string' ? apiKey : '',
    };
    // Keep the endpoint settings when a session-only key has expired.
    normalizeImageConfig({ ...candidate, apiKey: candidate.apiKey || 'validation-only' });
    return candidate;
  } catch {
    return { ...defaultImageConfig };
  }
}

export function saveImageConfig(config: ImageConfig): ImageConfig {
  const valid = normalizeImageConfig(config);
  const { apiKey, ...settings } = valid;
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ ...settings, ...(valid.rememberKey ? { apiKey } : {}) }),
  );
  if (valid.rememberKey) sessionStorage.removeItem(SESSION_KEY);
  else sessionStorage.setItem(SESSION_KEY, apiKey);
  return valid;
}

export function clearImageConfig() {
  localStorage.removeItem(SETTINGS_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export function referencePrompt(references: ImageReference[], lang: Lang): string {
  const details = references
    .map((ref, index) =>
      lang === 'zh'
        ? `参考图 ${index + 1}（${ref.kind === 'pose' ? '姿势' : '服装'}）：${ref.keywords.zh}。`
        : `Reference ${index + 1} (${ref.kind}): ${ref.keywords.en}.`,
    )
    .join('\n');
  return lang === 'zh'
    ? `结合所附参考图创作一幅完整的角色插画。遵循姿势参考的动作与重心，保留服装参考的穿搭与材质细节；角色完整着装，背景简洁，不添加文字或水印。\n${details}`
    : `Create a finished character illustration from the attached references. Follow the pose and balance of the pose reference and the garment and material details of the costume reference. Keep the character fully clothed, with a simple background and no text or watermark.\n${details}`;
}

export class ImageGenerationError extends Error {
  constructor(
    public code: string,
    message = '',
  ) {
    super(message);
  }
}

function safeMessage(message: string, key: string): string {
  return message
    .split(key)
    .join('[redacted]')
    .split(encodeURIComponent(key))
    .join('[redacted]')
    .replace(/[\u0000-\u001f]/g, ' ')
    .slice(0, 350);
}

export function imageResult(payload: unknown): string {
  const row = (payload as { data?: { b64_json?: unknown; url?: unknown }[] })?.data?.[0];
  if (typeof row?.b64_json === 'string') {
    const b64 = row.b64_json;
    if (b64.length > 100_000_000 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64))
      throw new ImageGenerationError('invalidResult');
    const signature = atob(b64.slice(0, 32));
    const mime = signature.startsWith('\x89PNG\r\n\x1a\n')
      ? 'image/png'
      : signature.startsWith('\xff\xd8\xff')
        ? 'image/jpeg'
        : signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP'
          ? 'image/webp'
          : '';
    if (!mime) throw new ImageGenerationError('invalidResult');
    return `data:${mime};base64,${b64}`;
  }
  if (typeof row?.url === 'string') {
    try {
      const url = new URL(row.url);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch {
      /* Report one consistent error for invalid provider output. */
    }
  }
  throw new ImageGenerationError('invalidResult');
}

export async function generateReferenceImage(
  config: ImageConfig,
  references: ImageReference[],
  prompt: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const valid = normalizeImageConfig(config);
  if (!references.length || !prompt.trim()) throw new ImageGenerationError('missingReference');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 180_000);
  const combined = AbortSignal.any([signal, timeout.signal]);
  try {
    const form = new FormData();
    form.set('model', valid.model);
    form.set('prompt', prompt.trim());
    form.set('n', '1');
    form.set('size', valid.size);
    form.set('quality', valid.quality);
    for (const reference of references) {
      const url = new URL(reference.variant.original);
      if (url.origin !== `https://ai-${reference.kind}-gallery.pages.dev`)
        throw new ImageGenerationError('referenceFailed');
      const response = await fetcher(url.href, {
        signal: combined,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok)
        throw new ImageGenerationError('referenceFailed', `HTTP ${response.status}`);
      const blob = await response.blob();
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) ||
        !blob.size ||
        blob.size > 50 * 1024 * 1024
      )
        throw new ImageGenerationError('referenceFailed');
      form.append(
        'image[]',
        blob,
        `${reference.variant.id}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'}`,
      );
    }
    const response = await fetcher(imageEndpoint(valid.baseUrl), {
      method: 'POST',
      signal: combined,
      credentials: 'omit',
      redirect: 'error',
      headers: { Authorization: `Bearer ${valid.apiKey}` },
      body: form,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
      const message = typeof payload?.error?.message === 'string' ? payload.error.message : '';
      throw new ImageGenerationError(
        'providerFailed',
        `HTTP ${response.status}${message ? ` · ${safeMessage(message, valid.apiKey)}` : ''}`,
      );
    }
    return imageResult(payload);
  } catch (error) {
    if (signal.aborted) throw new ImageGenerationError('cancelled');
    if (timeout.signal.aborted) throw new ImageGenerationError('timedOut');
    if (error instanceof ImageGenerationError) throw error;
    throw new ImageGenerationError('networkFailed');
  } finally {
    clearTimeout(timer);
  }
}
