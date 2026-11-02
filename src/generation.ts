import type { Kind, Lang, Reference, Variant } from './types';
import { isDepthVariant, poseDepthOrigin } from './pose-depth';
import { isCustomAsset } from './custom-assets';

export interface ImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  size: string;
  quality: 'auto' | 'low' | 'medium' | 'high';
  rememberKey: boolean;
}
interface ReferenceDetails {
  title: Reference['title'];
  keywords: Reference['keywords'];
  variant: Variant;
}
export interface GalleryImageReference extends ReferenceDetails {
  kind: Kind;
}
export interface UploadedImageReference extends ReferenceDetails {
  kind: 'character' | 'costume';
  file: File;
}
export type ImageReference = GalleryImageReference | UploadedImageReference;
export interface GenerationJob {
  model: string;
  references: ImageReference[];
  prompt: string;
  status: 'loading' | 'error' | 'success' | 'cancelled';
  result?: string;
  error?: string;
  size?: string;
  quality?: ImageConfig['quality'];
  restored?: boolean;
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
      // Migrate the retired model default while preserving the service and key.
      model: saved.model.startsWith('grok-') ? defaultImageConfig.model : saved.model,
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
  const hasCharacter = references.some((ref) => ref.kind === 'character');
  const roles = {
    pose: {
      zh: '仅采用此图当前展示的动作与单一观察角度。保持头部朝向、肩胯方向、肘腕位置、手势、腿部弯曲及遮挡关系，不擅自把双手移到身后。取景范围跟随此图。',
      en: 'Use only the pose and single viewpoint shown in this image. Preserve head direction, shoulder and hip orientation, elbows, wrists, hand gestures, bent legs and occlusion. Do not move the hands behind the back unless shown. Match this image\'s framing.',
    },
    costume: {
      zh: '仅提取可见服饰、鞋履及配饰的款式、颜色、材质与穿戴方式，穿到同一个人物身上；不复制陈列布局、空白间距或隐形人台外观。',
      en: 'Transfer only the visible garments, footwear and accessories, including design, colors, materials and placement, onto the same person. Do not copy the product arrangement, empty spacing or ghost-mannequin appearance.',
    },
    character: {
      zh: '仅保留此人物的身份、五官、脸型、发型发色、肤色与画风；不复制人物参考的动作、服饰或头像裁切，不额外生成头像或其他视角。',
      en: 'Preserve only this person\'s identity, facial features, face shape, hairstyle, hair color, skin tone and visual style. Do not copy this reference\'s pose, clothing or portrait crop, or add separate portraits or other views.',
    },
  };
  const details = references
    .map((ref, index) => {
      // Catalog keywords describe discovery and batches, not generation instructions.
      const detail =
        lang === 'zh'
          ? `参考图 ${index + 1}（${ref.kind === 'pose' ? '姿势' : ref.kind === 'costume' ? '服装' : '人物'}）：${roles[ref.kind].zh}`
          : `Reference ${index + 1} (${ref.kind}): ${roles[ref.kind].en}`;
      if (ref.kind !== 'pose' || !isDepthVariant(ref.variant)) return detail;
      return `${detail} ${
        lang === 'zh'
          ? '此图为深度图，越亮越靠近镜头。仅参考动作、透视与遮挡关系，不复制灰度、深色背景或人偶外观。'
          : 'This is a depth map: brighter areas are closer to the camera. Use only its pose, perspective and occlusion; do not copy the grayscale, dark background or mannequin appearance.'
      }`;
    })
    .join('\n');
  const output =
    lang === 'zh'
      ? '最终输出只有一张连续画面、一个人物、一个选定视角。禁止多面板、分栏、分镜、角色设定页、局部特写插图、其他角度附图或重复人物。所有参考信息融合到这一个人物中。'
      : 'Final output: one continuous scene, one person and one selected viewpoint only. No panels, columns, storyboards, character sheets, inset close-ups, additional-angle images or repeated people. Combine all references into that one person.';
  if (hasCharacter)
    return lang === 'zh'
      ? `结合所附参考图创作一幅完整的人物图。人物参考决定身份与画风：保留其五官、脸型、发型发色、肤色与体型比例；姿势参考只决定动作、重心与观察角度，不迁移人偶线条和关节；服装参考只决定穿搭、颜色、版型与材质，不迁移服装模特的脸和站姿。让服装随动作自然形变，人物完整着装，背景简洁，不添加文字或水印，不制作拼贴或对照图。\n${details}\n${output}`
      : `Create one complete character image from the attached references. Use the character reference for identity and visual style, preserving the face, hairstyle, hair color, skin tone and body proportions. Use the pose reference only for gesture, balance and viewpoint, without mannequin lines or joints. Use the costume reference only for outfit, colors, garment shape and materials, without copying the outfit model's face or stance. Make clothing drape naturally with the pose. Keep the character fully clothed, with a simple background and no text, watermark, collage or comparison layout.\n${details}\n${output}`;
  return lang === 'zh'
    ? `结合所附参考图创作一幅完整的角色插画。遵循姿势参考的动作与重心，保留服装参考的穿搭与材质细节；角色完整着装，背景简洁，不添加文字或水印。\n${details}\n${output}`
    : `Create a finished character illustration from the attached references. Follow the pose and balance of the pose reference and the garment and material details of the costume reference. Keep the character fully clothed, with a simple background and no text or watermark.\n${details}\n${output}`;
}

export class ImageGenerationError extends Error {
  constructor(
    public code: string,
    message = '',
  ) {
    super(message);
  }
}

export async function validateReferenceFile(
  file: File,
  kind: 'character' | 'costume',
): Promise<void> {
  if (file.size > 10 * 1024 * 1024) throw new ImageGenerationError(`${kind}TooLarge`);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const signature = String.fromCharCode(...bytes);
  const mime = signature.startsWith('\x89PNG\r\n\x1a\n')
    ? 'image/png'
    : signature.startsWith('\xff\xd8\xff')
      ? 'image/jpeg'
      : signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP'
        ? 'image/webp'
        : '';
  if (!mime || mime !== file.type) throw new ImageGenerationError(`${kind}Invalid`);
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
    const urls = references.map((reference) => {
      if ('file' in reference) return null;
      const url = new URL(reference.variant.original);
      const allowedOrigins = [
        `https://ai-${reference.kind === 'character' ? 'portrait' : reference.kind}-gallery.pages.dev`,
        ...(reference.kind === 'pose' ? [poseDepthOrigin] : []),
      ];
      if (
        url.username ||
        url.password ||
        (!allowedOrigins.includes(url.origin) && !isCustomAsset(url.href, reference.kind))
      )
        throw new ImageGenerationError('referenceFailed');
      return url.href;
    });
    for (const reference of references)
      if ('file' in reference) await validateReferenceFile(reference.file, reference.kind);
    const form = new FormData();
    form.set('model', valid.model);
    form.set('prompt', prompt.trim());
    form.set('n', '1');
    form.set('size', valid.size);
    form.set('quality', valid.quality);
    for (const [index, reference] of references.entries()) {
      combined.throwIfAborted();
      let blob: Blob;
      if ('file' in reference) blob = reference.file;
      else {
        const response = await fetcher(urls[index]!, {
          signal: combined,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok)
          throw new ImageGenerationError('referenceFailed', `HTTP ${response.status}`);
        blob = await response.blob();
      }
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) ||
        !blob.size ||
        blob.size > 50 * 1024 * 1024
      )
        throw new ImageGenerationError('referenceFailed');
      form.append(
        'image[]',
        blob,
        `${'file' in reference ? `${reference.kind}-upload` : reference.variant.id}.${blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'}`,
      );
    }
    combined.throwIfAborted();
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
