import { zipSync } from 'fflate';
import type { ImageReference } from './generation';

/** Export the references submitted for this result, including persisted uploads. */
export async function referenceArchive(
  references: ImageReference[],
  fetcher: typeof fetch = fetch,
): Promise<Blob> {
  if (!references.length) throw Error('missingReference');
  const files: Record<string, Uint8Array> = {};
  for (const [index, reference] of references.entries()) {
    let blob: Blob;
    if ('file' in reference) blob = reference.file;
    else {
      const url = new URL(reference.variant.original);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw Error('invalidReference');
      const response = await fetcher(url.href, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw Error('referenceDownloadFailed');
      blob = await response.blob();
    }
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[blob.type];
    if (!extension || !blob.size || blob.size > 50 * 1024 * 1024) throw Error('invalidReference');
    files[`${index + 1}-${reference.kind}.${extension}`] = new Uint8Array(await blob.arrayBuffer());
  }
  // Images are already compressed; storing them avoids unnecessary CPU work.
  return new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
}

export async function downloadReferences(references: ImageReference[], createdAt: number) {
  const blob = await referenceArchive(references);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `references-${new Date(createdAt).toISOString().replace(/[:.]/g, '-')}.zip`;
  const dialogs = document.querySelectorAll('dialog[open]');
  (dialogs[dialogs.length - 1] || document.body).appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
