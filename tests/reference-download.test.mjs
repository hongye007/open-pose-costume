import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { createServer } from 'vite';

const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { referenceArchive } = await vite.ssrLoadModule('/src/reference-download.ts');
after(() => vite.close());
const pose = {
  kind: 'pose',
  variant: { original: 'https://ai-pose-gallery.pages.dev/original.png' },
};
const outfit = {
  kind: 'costume',
  variant: { original: 'blob:expired' },
  file: new File(['outfit'], 'private.jpg', { type: 'image/jpeg' }),
};
const character = {
  kind: 'character',
  variant: { original: 'blob:expired' },
  file: new File(['person'], 'private.webp', { type: 'image/webp' }),
};

test('reference ZIP preserves original bytes and optional uploaded references without fetching stale previews', async () => {
  const requests = [];
  const archive = await referenceArchive([pose, outfit, character], async (url, options) => {
    requests.push({ url, options });
    return new Response('pose', { headers: { 'Content-Type': 'image/png' } });
  });
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ['1-pose.png', '2-costume.jpg', '3-character.webp']);
  assert.equal(new TextDecoder().decode(files['1-pose.png']), 'pose');
  assert.equal(new TextDecoder().decode(files['2-costume.jpg']), 'outfit');
  assert.equal(new TextDecoder().decode(files['3-character.webp']), 'person');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, pose.variant.original);
  assert.equal(requests[0].options.credentials, 'omit');
  assert.equal(requests[0].options.headers, undefined);
});

test('no character selected produces only the selected pose and costume files', async () => {
  const archive = await referenceArchive(
    [pose, outfit],
    async () => new Response('pose', { headers: { 'Content-Type': 'image/png' } }),
  );
  assert.deepEqual(Object.keys(unzipSync(new Uint8Array(await archive.arrayBuffer()))), [
    '1-pose.png',
    '2-costume.jpg',
  ]);
});

test('failed or invalid sources reject the whole archive instead of silently omitting a reference', async () => {
  for (const response of [
    new Response('missing', { status: 404 }),
    new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }),
  ]) {
    await assert.rejects(referenceArchive([outfit, pose], async () => response));
  }
  await assert.rejects(referenceArchive([]));
  await assert.rejects(
    referenceArchive([{ ...pose, variant: { original: 'file:///private.png' } }], async () => {
      throw Error('must not fetch');
    }),
  );
});
