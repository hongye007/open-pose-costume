import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { normalize, readJson } from '../scripts/build-data.mjs';
import { normalizePortraits } from '../scripts/portrait-data.mjs';
import { extractDataset } from '../scripts/sync.mjs';

const [pose, costume, zh, portrait, catalog, manifest] = await Promise.all(
  [
    'data/source/pose.json',
    'data/source/costume.json',
    'data/source/pose-zh.json',
    'data/source/portrait.json',
    'public/data/catalog.json',
    'data/sync-manifest.json',
  ].map(readJson),
);
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { matchesQuery, sortItems, storageGet } = await vite.ssrLoadModule('/src/library.ts');
const { withPoseDepth, poseDepthOrigin } = await vite.ssrLoadModule('/src/pose-depth.ts');
after(async () => {
  await vite.close();
});

test('all source records are preserved, uniquely grouped, with no invented angles', async () => {
  assert.deepEqual(await normalize(pose, costume, zh, portrait), catalog);
  const poseGroups = catalog.items.filter((item) => item.kind === 'pose');
  assert.equal(
    poseGroups.reduce((sum, item) => sum + item.variants.length, 0),
    pose.length,
  );
  assert.equal(catalog.items.filter((item) => item.kind === 'costume').length, costume.length);
  assert.equal(new Set(catalog.items.map((item) => item.id)).size, catalog.items.length);
  assert.equal(catalog.stats.images, pose.length + costume.length + portrait.length);
  assert.deepEqual(
    new Set(poseGroups.flatMap((item) => item.variants.map((variant) => variant.id))),
    new Set(pose.map((row) => row.id)),
  );
});

test('every reference and variant has complete Chinese and English, and only original external image URLs', () => {
  for (const item of catalog.items) {
    for (const field of ['title', 'category', 'series', 'keywords']) {
      assert.ok(item[field].zh.length > 0, `${item.id} ${field}.zh`);
      assert.ok(item[field].en.length > 0, `${item.id} ${field}.en`);
      assert.doesNotMatch(item[field].en, /[\u3040-\u30ff\u4e00-\u9fff]/);
    }
    for (const variant of item.variants) {
      for (const key of ['thumbnail', 'image', 'original']) {
        assert.equal(
          new URL(variant[key]).origin,
          item.kind === 'pose'
            ? 'https://ai-pose-gallery.pages.dev'
            : item.kind === 'costume'
              ? 'https://ai-costume-gallery.pages.dev'
              : 'https://ai-portrait-gallery.pages.dev',
        );
      }
      assert.ok(variant.label.zh && variant.label.en);
    }
  }
});

test('source snapshot hashes and counts match the crawl manifest', () => {
  for (const [index, rows] of [pose, costume, zh, portrait].entries()) {
    assert.equal(manifest.sources[index].records, rows.length);
    assert.equal(
      manifest.sources[index].sha256,
      createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    );
  }
  assert.equal(manifest.imagesDownloaded, 0);
});

test('scraper treats source scripts as untrusted JSON and handles brackets in strings', () => {
  const data = [{ id: 'test', title: 'A ] bracket and a "quote"' }];
  assert.deepEqual(
    extractDataset(`<script>const D=${JSON.stringify(data)};doSomething()</script>`),
    data,
  );
  assert.throws(() => extractDataset('const D=[{ "id": "broken" }'));
  assert.throws(() => extractDataset('const D=(()=>{throw Error("execute")})()'));
  assert.throws(() => extractDataset('const OTHER=[]'));
});

test('search works in both languages, accepts joined Chinese clothing terms and intersects terms', () => {
  const coat = catalog.items.find(
    (item) =>
      item.kind === 'costume' &&
      item.keywords.en.includes('blue') &&
      item.keywords.en.includes('coat'),
  );
  assert.ok(coat);
  for (const query of [
    'blue coat',
    '蓝色 大衣',
    '蓝色大衣',
    'BLUE COAT',
    coat.id.toLowerCase(),
    'blue 大衣',
  ])
    assert.ok(matchesQuery(coat, query), query);
  assert.ok(!matchesQuery(coat, 'blue not-a-real-garment'));
  assert.ok(
    matchesQuery(
      catalog.items.find((item) => item.id === 'full_single_P045'),
      'side sitting',
    ),
  );
  assert.ok(
    matchesQuery(
      catalog.items.find((item) => item.id === 'full_single_P045'),
      '侧坐',
    ),
  );
  assert.ok(matchesQuery(coat, ''));
});

test('all sort modes preserve every reference', () => {
  for (const mode of ['curated', 'name', 'code']) {
    const sorted = sortItems(catalog.items, mode, 'en');
    assert.equal(sorted.length, catalog.items.length);
    assert.equal(new Set(sorted.map((item) => item.id)).size, catalog.items.length);
  }
  assert.equal(sortItems(catalog.items, 'curated', 'en')[0].kind, 'pose');
  assert.equal(sortItems(catalog.items, 'curated', 'en')[1].kind, 'costume');
});

test('missing, damaged, or inaccessible local storage falls back safely', () => {
  const validator = (v) => Array.isArray(v) && v.every((id) => typeof id === 'string');
  globalThis.localStorage = { getItem: () => '{bad-json' };
  assert.deepEqual(storageGet('saved', [], validator), []);
  globalThis.localStorage = { getItem: () => JSON.stringify([42]) };
  assert.deepEqual(storageGet('saved', [], validator), []);
  globalThis.localStorage = {
    getItem: () => {
      throw Error('SecurityError');
    },
  };
  assert.deepEqual(storageGet('saved', [], validator), []);
  delete globalThis.localStorage;
});

test('portrait ingestion preserves both sections, translates styles and rejects unsafe or incomplete records', async () => {
  const characters = catalog.items.filter((item) => item.kind === 'character');
  assert.equal(characters.length, portrait.length);
  assert.equal(characters.filter((item) => item.portrait.section === 'face').length, 893);
  assert.equal(characters.filter((item) => item.portrait.section === 'styling').length, 606);
  assert.ok(
    matchesQuery(
      characters.find((item) => item.title.en.includes('Black short bob')),
      '黑色 螺旋',
    ),
  );
  assert.ok(
    matchesQuery(
      characters.find((item) => item.title.en.includes('Black short bob')),
      'black spiral',
    ),
  );
  for (const row of [
    { ...portrait[0], full: 'https://other.example/image.png' },
    { ...portrait[0], section: 'unknown' },
    { ...portrait[0], hair: 'unknown' },
    { ...portrait[0], style: 'unknown' },
  ])
    await assert.rejects(normalizePortraits([row]));
  await assert.rejects(normalizePortraits([portrait[0], portrait[0]]));
  assert.deepEqual(
    extractDataset(
      'window.GALLERY_IMAGES=[{"id":"safe"}];throw Error("untrusted");',
      /\bwindow\.GALLERY_IMAGES\s*=\s*/,
    ),
    [{ id: 'safe' }],
  );
});

test('depth mode preserves catalog identity and angles without mutating originals', () => {
  const snapshot = JSON.stringify(catalog);
  for (const item of catalog.items) {
    const depth = withPoseDepth(item);
    if (item.kind !== 'pose') {
      assert.equal(depth, item);
      continue;
    }
    assert.deepEqual({ ...depth, source: item.source, variants: item.variants }, item);
    assert.equal(depth.variants.length, item.variants.length);
    for (const [index, variant] of depth.variants.entries()) {
      const original = item.variants[index];
      assert.equal(variant.id, original.id);
      assert.equal(variant.angle, original.angle);
      assert.deepEqual(variant.label, original.label);
      for (const field of ['thumbnail', 'image', 'original']) {
        assert.equal(new URL(variant[field]).origin, poseDepthOrigin);
        assert.equal(new URL(variant[field]).pathname, new URL(original[field]).pathname);
      }
    }
  }
  assert.equal(JSON.stringify(catalog), snapshot);
});
