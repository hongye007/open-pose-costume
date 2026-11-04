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
const animeOutfit = custom.find((item) => item.provenance.batch === 'anime-outfits-01');
const customCostume = custom.find((item) => item.kind === 'costume');
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const assets = await vite.ssrLoadModule('/src/custom-assets.ts');
const { matchesQuery, matchesExtension } = await vite.ssrLoadModule('/src/library.ts');
const { hasPoseDepth, isDepthVariant, withPoseDepth } =
  await vite.ssrLoadModule('/src/pose-depth.ts');
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
  assert.equal(custom.filter((item) => item.provenance.batch === 'moon-extraction-01').length, 1);
  for (const item of custom) {
    for (const variant of item.variants) {
      const [original, image, thumb] = await Promise.all(
        ['original', 'image', 'thumbnail'].map((key) =>
          readFile(new URL(`../public/${variant[key]}`, import.meta.url)),
        ),
      );
      assert.equal(
        createHash('sha256').update(original).digest('hex'),
        variant.provenance?.originalSha256 || item.provenance.originalSha256,
      );
      assert.equal(original.subarray(1, 4).toString(), 'PNG');
      assert.equal(original.readUInt32BE(16), variant.provenance?.width || 1024);
      assert.equal(original.readUInt32BE(20), variant.provenance?.height || 1536);
      assert.equal(image.toString('ascii', 8, 12), 'WEBP');
      assert.equal(thumb.toString('ascii', 8, 12), 'WEBP');
      assert.ok(thumb.length < image.length);
      if (variant.depth) {
        const depth = variant.depth;
        const [depthOriginal, depthPreview, depthThumb] = await Promise.all(
          ['original', 'image', 'thumbnail'].map((key) =>
            readFile(new URL(`../public/${depth[key]}`, import.meta.url)),
          ),
        );
        if (depth.provenance.sourceSha256)
          assert.equal(
            createHash('sha256').update(original).digest('hex'),
            depth.provenance.sourceSha256,
          );
        assert.equal(
          createHash('sha256').update(depthOriginal).digest('hex'),
          depth.provenance.originalSha256,
        );
        assert.equal(depthOriginal.readUInt32BE(16), depth.provenance.width);
        assert.equal(depthOriginal.readUInt32BE(20), depth.provenance.height);
        assert.equal(depthPreview.toString('ascii', 8, 12), 'WEBP');
        assert.equal(depthThumb.toString('ascii', 8, 12), 'WEBP');
        assert.equal(depth.provenance.aiInferred, true);
        assert.equal(depth.provenance.calibrated, false);
      }
    }
  }
});

test('custom and anime filters intersect with categories and bilingual search', () => {
  for (const query of ['动漫', 'Anime', '自建扩展', 'custom'])
    assert.ok(matchesQuery(animeOutfit, query));
  const anime = catalog.items.filter((item) => matchesExtension(item, 'custom', 'anime'));
  assert.equal(anime.length, 30);
  assert.equal(
    catalog.items.filter((item) => matchesExtension(item, 'builtin', 'anime')).length,
    1320,
  );
  assert.ok(anime.some((item) => item.extended));
  assert.ok(anime.some((item) => !item.extended && item.category.id === 'summer'));
  assert.ok(!matchesQuery(animeOutfit, 'nonexistent-garment'));
});

test('regional portraits expose the active fictional identities through bilingual search and subject filters', () => {
  const portraits = custom.filter(
    (item) => item.provenance.batch === 'custom-character-regions-01',
  );
  assert.equal(portraits.length, 21);
  assert.equal(portraits.filter((item) => matchesExtension(item, 'custom', 'male')).length, 10);
  assert.equal(portraits.filter((item) => matchesExtension(item, 'custom', 'female')).length, 11);
  const countries = new Set(portraits.map((item) => item.provenance.editorialCountry.code));
  assert.equal(countries.size, 11);
  for (const country of countries) {
    const pair = portraits.filter((item) => item.provenance.editorialCountry.code === country);
    const genders = country === 'kr' ? ['female'] : ['male', 'female'];
    assert.equal(pair.length, genders.length);
    assert.deepEqual(new Set(pair.map((item) => item.tags[0].id)), new Set(genders));
    for (const item of pair) {
      assert.equal(item.kind, 'character');
      assert.equal(item.portrait.section, 'face');
      assert.ok(['short', 'medium', 'medium-long', 'long'].includes(item.portrait.hair));
      assert.equal(item.provenance.fictional, true);
      for (const lang of ['zh', 'en'])
        assert.ok(matchesQuery(item, item.provenance.editorialCountry[lang]));
    }
  }
});

test('male references expose original five-view poses and eleven outfits through bilingual filters', () => {
  const male = custom.filter((item) => matchesExtension(item, 'custom', 'male'));
  const allPoses = male.filter((item) => item.kind === 'pose');
  const poses = allPoses;
  const outfits = male.filter((item) => item.kind === 'costume');
  assert.equal(poses.length, 22);
  assert.equal(outfits.length, 11);
  assert.equal(
    poses.reduce((n, item) => n + item.variants.length, 0),
    110,
  );
  for (const item of male) {
    assert.ok(matchesQuery(item, '男性'));
    assert.ok(matchesQuery(item, 'Male'));
    assert.ok(!matchesExtension(item, 'builtin', 'male'));
  }
  for (const pose of poses) {
    assert.deepEqual(
      pose.variants.map((variant) => variant.angle),
      ['front', 'high', 'low', 'side', 'diag'],
    );
    if (pose.variants.every((v) => v.depth)) {
      assert.ok(hasPoseDepth(pose));
      const depth = withPoseDepth(pose);
      for (const [index, variant] of depth.variants.entries()) {
        assert.equal(variant.original, pose.variants[index].depth.original);
        assert.ok(isDepthVariant(variant));
      }
    } else assert.equal(withPoseDepth(pose), pose);
    assert.equal(new Set(pose.variants.map((variant) => variant.original)).size, 5);
    assert.equal(
      new Set(pose.variants.map((variant) => variant.provenance.originalSha256)).size,
      5,
    );
  }
});

test('male portraits filter by language and hair length and submit the original with pose and outfit', async (t) => {
  const portraits = custom.filter(
    (item) => item.provenance.batch === 'male-character-styles-06-01',
  );
  assert.equal(portraits.length, 6);
  assert.deepEqual(
    portraits.map((item) => item.portrait.hair),
    ['short', 'medium', 'short', 'short', 'medium', 'long'],
  );
  for (const item of portraits) {
    assert.equal(item.portrait.section, 'face');
    assert.ok(matchesQuery(item, '男性'));
    assert.ok(matchesQuery(item, 'Male'));
  }
  globalThis.location = { origin: 'http://127.0.0.1:5199' };
  t.after(() => delete globalThis.location);
  const resolved = assets.resolveCustomAssets(catalog);
  const selections = ['pose', 'costume', 'character'].map((kind) =>
    resolved.items.find((item) => item.kind === kind && matchesExtension(item, 'custom', 'male')),
  );
  const originals = await Promise.all(
    selections.map((item) =>
      readFile(
        new URL(
          `../public/${new URL(item.variants[0].original).pathname.slice(1)}`,
          import.meta.url,
        ),
      ),
    ),
  );
  let uploads = 0;
  await generation.generateReferenceImage(
    { ...generation.defaultImageConfig, apiKey: 'test-key' },
    selections.map((item) => ({
      kind: item.kind,
      title: item.title,
      keywords: item.keywords,
      variant: item.variants[0],
    })),
    'draw',
    new AbortController().signal,
    async (url, options) => {
      if (options?.method === 'POST') {
        uploads++;
        const files = options.body.getAll('image[]');
        assert.equal(files.length, 3);
        for (let index = 0; index < files.length; index++)
          assert.deepEqual(Buffer.from(await files[index].arrayBuffer()), originals[index]);
        return Response.json({ data: [{ url: 'https://result.example/image.png' }] });
      }
      assert.equal(options.headers, undefined);
      const index = selections.findIndex((item) => item.variants[0].original === url);
      assert.ok(index >= 0);
      return new Response(originals[index], { headers: { 'Content-Type': 'image/png' } });
    },
  );
  assert.equal(uploads, 1);
});

test('custom depth keeps project-base URLs, generation uploads and history semantics intact', async (t) => {
  globalThis.location = { origin: 'http://127.0.0.1:5199' };
  t.after(() => delete globalThis.location);
  const base = new URL('http://127.0.0.1:5199/');
  const resolved = assets.resolveCustomAssets(catalog, base);
  const poses = resolved.items.filter(
    (item) => item.kind === 'pose' && item.collection === 'custom' && hasPoseDepth(item),
  );
  assert.equal(poses.length, 36);
  assert.equal(poses.flatMap((item) => item.variants).length, 180);
  const selected = withPoseDepth(poses[0]);
  const reference = {
    kind: 'pose',
    title: selected.title,
    keywords: selected.keywords,
    variant: selected.variants[0],
  };
  assert.ok(reference.variant.original.endsWith('_depth.png'));
  assert.ok(isDepthVariant(structuredClone(reference.variant)));
  assert.match(generation.referencePrompt([reference], 'zh'), /越亮越靠近镜头/);
  assert.match(generation.referencePrompt([reference], 'en'), /brighter areas are closer/);
  const bytes = await readFile(
    new URL(`../public/${new URL(reference.variant.original).pathname.slice(1)}`, import.meta.url),
  );
  let fetched = false;
  await generation.generateReferenceImage(
    { ...generation.defaultImageConfig, apiKey: 'test-only' },
    [reference],
    'depth pose',
    new AbortController().signal,
    async (url, options) => {
      if (options?.method === 'POST') {
        assert.ok(fetched);
        assert.deepEqual(Buffer.from(await options.body.getAll('image[]')[0].arrayBuffer()), bytes);
        return Response.json({ data: [{ url: 'https://result.example/depth.png' }] });
      }
      assert.equal(url, reference.variant.original);
      assert.equal(options.headers, undefined);
      fetched = true;
      return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
    },
  );
  for (const baseHref of [
    'http://127.0.0.1:5199/',
    'https://hongye007.github.io/open-pose-costume/',
  ]) {
    const deployed = assets.resolveCustomAssets(catalog, new URL(baseHref));
    for (const item of deployed.items.filter(
      (item) => item.kind === 'pose' && item.collection === 'custom' && hasPoseDepth(item),
    )) {
      for (const variant of withPoseDepth(item).variants) {
        assert.ok(variant.original.startsWith(baseHref));
        assert.ok(assets.isCustomAsset(variant.original, 'pose', new URL(baseHref)));
      }
    }
  }
});

test('custom assets respect project bases and reject other origins, paths and kinds', () => {
  for (const base of ['http://127.0.0.1:5199/', 'https://hongye007.github.io/open-pose-costume/']) {
    const baseUrl = new URL(base);
    const resolved = assets.resolveCustomAssets(catalog, baseUrl);
    const costume = resolved.items.find(
      (item) => item.collection === 'custom' && item.kind === 'costume',
    );
    const url = costume.variants[0].original;
    assert.equal(url, base + customCostume.variants[0].original);
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
    customCostume.variants[0].original.startsWith('custom/'),
    'resolution does not mutate the catalog',
  );
});

test('generation and ZIP download fetch the custom original, without sending the API key to static assets', async (t) => {
  globalThis.location = { origin: 'http://127.0.0.1:5199' };
  t.after(() => delete globalThis.location);
  const item = assets
    .resolveCustomAssets(catalog)
    .items.find((item) => item.collection === 'custom' && item.kind === 'costume');
  const reference = {
    kind: item.kind,
    title: item.title,
    keywords: item.keywords,
    variant: item.variants[0],
  };
  const original = await readFile(
    new URL(`../public/${customCostume.variants[0].original}`, import.meta.url),
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
