import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { createServer } from 'vite';
import { readJson } from '../scripts/build-data.mjs';
import { loadCustomReferences } from '../scripts/custom-data.mjs';

const catalog = await readJson('public/data/catalog.json');
const custom = catalog.items.filter((item) => item.collection === 'custom');
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const assets = await vite.ssrLoadModule('/src/custom-assets.ts');
const { matchesQuery, matchesExtension } = await vite.ssrLoadModule('/src/library.ts');
const { withPoseDepth } = await vite.ssrLoadModule('/src/pose-depth.ts');
const generation = await vite.ssrLoadModule('/src/generation.ts');
const { referenceArchive } = await vite.ssrLoadModule('/src/reference-download.ts');
after(() => vite.close());

test('custom manifests merge independently, with original hashes and separate cover files', async () => {
  assert.deepEqual(
    await loadCustomReferences(catalog.items.filter((item) => !item.collection)),
    custom,
  );
  await assert.rejects(loadCustomReferences(custom), /duplicate custom ID/);
  assert.equal(custom.filter((item) => item.provenance.batch === 'anime-outfits-01').length, 30);
  assert.equal(custom.filter((item) => item.tags.some((tag) => tag.id === 'photo')).length, 1);
  for (const item of custom) {
    for (const variant of item.variants) {
      const [original, image, thumb] = await Promise.all(
        ['original', 'image', 'thumbnail'].map((key) =>
          readFile(new URL(`../public/${variant[key]}`, import.meta.url)),
        ),
      );
      assert.equal(
        createHash('sha256').update(original).digest('hex'),
        item.provenance.originalSha256,
      );
      assert.equal(original.subarray(1, 4).toString(), 'PNG');
      assert.equal(original.readUInt32BE(16), 1024);
      assert.equal(original.readUInt32BE(20), 1536);
      assert.equal(image.toString('ascii', 8, 12), 'WEBP');
      assert.equal(thumb.toString('ascii', 8, 12), 'WEBP');
      assert.ok(thumb.length < image.length);
    }
  }
});

test('custom and anime filters intersect with categories and bilingual search', () => {
  for (const query of ['动漫', 'Anime', '自建扩展', 'custom'])
    assert.ok(matchesQuery(custom[0], query));
  const anime = catalog.items.filter((item) => matchesExtension(item, 'custom', 'anime'));
  assert.equal(anime.length, 30);
  assert.equal(
    catalog.items.filter((item) => matchesExtension(item, 'builtin', 'anime')).length,
    0,
  );
  assert.ok(anime.some((item) => item.extended));
  assert.ok(anime.some((item) => !item.extended && item.category.id === 'summer'));
  assert.ok(!matchesQuery(custom[0], 'nonexistent-garment'));
});

test('custom assets respect project bases and reject other origins, paths and kinds', () => {
  for (const base of ['http://127.0.0.1:5199/', 'https://hongye007.github.io/open-pose-costume/']) {
    const baseUrl = new URL(base);
    const resolved = assets.resolveCustomAssets(catalog, baseUrl);
    const costume = resolved.items.find((item) => item.collection === 'custom');
    const url = costume.variants[0].original;
    assert.equal(url, base + custom[0].variants[0].original);
    assert.ok(assets.isCustomAsset(url, 'costume', baseUrl));
    assert.ok(!assets.isCustomAsset(url, 'pose', baseUrl));
    for (const bad of [
      url + '?key=secret',
      url + '#x',
      url.replace('custom/', 'private/'),
      url.replace(baseUrl.origin, 'https://other.example'),
      `${base}custom/costume/originals/../../private.png`,
    ])
      assert.ok(!assets.isCustomAsset(bad, 'costume', baseUrl), bad);
    assert.ok(
      !assets.isCustomAsset(
        new URL('/custom/costume/originals/x.png', 'https://other.example').href,
        undefined,
        baseUrl,
      ),
    );
    const syntheticPose = { ...costume, kind: 'pose' };
    assert.equal(withPoseDepth(syntheticPose), syntheticPose);
  }
  assert.ok(
    custom[0].variants[0].original.startsWith('custom/'),
    'resolution does not mutate the catalog',
  );
});

test('generation and ZIP download fetch the custom original, without sending the API key to static assets', async (t) => {
  globalThis.location = { origin: 'http://127.0.0.1:5199' };
  t.after(() => delete globalThis.location);
  const item = assets
    .resolveCustomAssets(catalog)
    .items.find((item) => item.collection === 'custom');
  const reference = {
    kind: item.kind,
    title: item.title,
    keywords: item.keywords,
    variant: item.variants[0],
  };
  const original = await readFile(
    new URL(`../public/${custom[0].variants[0].original}`, import.meta.url),
  );
  const requests = [];
  const result = await generation.generateReferenceImage(
    { ...generation.defaultImageConfig, apiKey: 'test-key' },
    [reference],
    'draw',
    new AbortController().signal,
    async (url, options) => {
      requests.push({ url, options });
      if (options?.method === 'POST') {
        const submitted = options.body.get('image[]');
        assert.deepEqual(Buffer.from(await submitted.arrayBuffer()), original);
        assert.equal(options.headers.Authorization, 'Bearer test-key');
        return Response.json({ data: [{ url: 'https://result.example/image.png' }] });
      }
      assert.equal(options.headers, undefined);
      assert.equal(options.credentials, 'omit');
      return new Response(original, { headers: { 'Content-Type': 'image/png' } });
    },
  );
  assert.equal(result, 'https://result.example/image.png');
  assert.equal(requests[0].url, reference.variant.original);
  assert.equal(requests.length, 2);
  const archive = await referenceArchive([reference], async (url) => {
    assert.equal(url, reference.variant.original);
    return new Response(original, { headers: { 'Content-Type': 'image/png' } });
  });
  assert.deepEqual(
    Buffer.from(unzipSync(new Uint8Array(await archive.arrayBuffer()))['1-costume.png']),
    original,
  );
  for (const bad of [
    'http://127.0.0.1:5199/private.png',
    'https://other.example/custom/costume/originals/x.png',
  ]) {
    await assert.rejects(
      generation.generateReferenceImage(
        { ...generation.defaultImageConfig, apiKey: 'test-key' },
        [{ ...reference, variant: { ...reference.variant, original: bad } }],
        'draw',
        new AbortController().signal,
        async () => {
          throw Error('must not fetch');
        },
      ),
      (error) => error.code === 'referenceFailed',
    );
  }
});
