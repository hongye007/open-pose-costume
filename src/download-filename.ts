/** Keep reference names recognizable while making every download unique. */
export function downloadFilename(name: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace('Z', '');
  return `${name}-${timestamp}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
}
