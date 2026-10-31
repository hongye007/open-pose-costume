import { generateReferenceImage, ImageGenerationError, validateReferenceFile } from './generation';
import type { ImageConfig, UploadedImageReference } from './generation';

export const costumeExtractionPrompt = `Extract the complete outfit from the attached image into a clean clothing reference on a plain white background.
Show only the garments, shoes and outfit accessories, arranged as an unobstructed, front-facing flat lay or invisible-body product display.
Remove the person, face, hair, skin, body parts, mannequin and original background. Do not include any human figure.
Preserve the original garment design, silhouette, proportions, colors, fabric texture, patterns and decorative details as faithfully as possible.
Keep all visible outfit pieces together in one image. Do not invent additional clothing or accessories. No text, labels, logos added or borders.`;

export async function extractCostume(
  config: ImageConfig,
  file: File,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<File> {
  const reference: UploadedImageReference = {
    kind: 'costume',
    file,
    title: { zh: '上传的服饰', en: 'Uploaded outfit' },
    keywords: { zh: '', en: '' },
    variant: {
      id: 'costume-upload',
      angle: 'front',
      label: { zh: '服饰', en: 'Outfit' },
      thumbnail: '',
      image: '',
      original: '',
    },
  };
  const source = await generateReferenceImage(
    { ...config, size: '1024x1536' },
    [reference],
    costumeExtractionPrompt,
    signal,
    fetcher,
  );
  signal.throwIfAborted();
  const response = await fetcher(source, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  if (!response.ok) throw new ImageGenerationError('invalidResult');
  const blob = await response.blob();
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type];
  if (!extension) throw new ImageGenerationError('invalidResult');
  const extracted = new File([blob], `costume-extracted.${extension}`, { type: blob.type });
  await validateReferenceFile(extracted, 'costume');
  signal.throwIfAborted();
  return extracted;
}
