import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readJson } from '../scripts/build-data.mjs';
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { filterReferences, readTagFilters, sortItems, matchesQuery, referenceTagLabel } =
  await vite.ssrLoadModule('/src/library.ts');
after(() => vite.close());
const { items } = await readJson('public/data/catalog.json');

test('subject and visual style intersect independently without inferring untagged gender', () => {
  const photos = filterReferences(items, { tag: 'male', style: 'photo' });
  assert.equal(photos.length, 30);
  assert.ok(photos.every((item) => ['costume', 'character'].includes(item.kind)));
  assert.equal(filterReferences(items, { tag: 'male', style: 'anime' }).length, 0);
  assert.equal(
    filterReferences(items, { kind: 'pose', tag: 'male', style: 'line-art' }).length,
    22,
  );
  const untagged = { ...items[0], id: 'untagged', tags: undefined };
  assert.equal(filterReferences([untagged], { tag: 'male' }).length, 0);
  assert.equal(filterReferences([untagged], { tag: 'female' }).length, 0);
  assert.equal(filterReferences([untagged], {}).length, 1);
});

test('category, source, subject, style and search narrow the same result set', () => {
  const filters = { collection: 'custom', tag: 'male', style: 'line-art', query: '提取动作' };
  const poses = filterReferences(items, filters);
  assert.equal(poses.length, 3);
  assert.equal(filterReferences(items, { ...filters, category: 'standing' }).length, 3);
  assert.equal(filterReferences(items, { ...filters, category: 'sitting' }).length, 0);
  assert.equal(filterReferences(items, { ...filters, collection: 'builtin' }).length, 0);
  assert.equal(
    filterReferences(items, { kind: 'character', tag: 'male', style: 'photo', hair: 'long' })
      .length,
    1,
  );
});

test('existing style-tag links migrate while subject links accept an independent style', () => {
  assert.deepEqual(readTagFilters(new URLSearchParams('tag=anime')), {
    tag: 'all',
    style: 'anime',
  });
  assert.deepEqual(readTagFilters(new URLSearchParams('tag=male&style=photo')), {
    tag: 'male',
    style: 'photo',
  });
  assert.deepEqual(readTagFilters(new URLSearchParams('tag=female&style=photo')), {
    tag: 'female',
    style: 'photo',
  });
  assert.deepEqual(readTagFilters(new URLSearchParams('tag=female')), {
    tag: 'female',
    style: 'all',
  });
  assert.deepEqual(readTagFilters(new URLSearchParams()), { tag: 'all', style: 'all' });
});

test('existing characters are female photographic references, while custom male tags stay intact', () => {
  const originals = items.filter((item) => item.kind === 'character' && !item.collection);
  const females = filterReferences(items, { kind: 'character', tag: 'female', style: 'photo' });
  assert.equal(originals.length, 1499);
  assert.deepEqual(
    females.filter((item) => !item.collection).map((item) => item.id),
    originals.map((item) => item.id),
  );
  assert.equal(
    filterReferences(items, { kind: 'character', collection: 'custom', tag: 'female' }).length,
    20,
  );
  assert.equal(filterReferences(items, { kind: 'character', tag: 'male' }).length, 19);
  const longHair = filterReferences(items, { tag: 'female', style: 'photo', hair: 'long' });
  assert.ok(longHair.length > 0);
  assert.ok(longHair.every((item) => item.portrait.hair === 'long'));
  assert.equal(filterReferences(items, { kind: 'character', query: '女性 写实' }).length, 1519);
  assert.equal(
    filterReferences(items, { kind: 'character', query: 'Female Photographic' }).length,
    1519,
  );
});

test('existing costumes are female photographic references; poses keep their existing style tags', () => {
  for (const [kind, expected] of [
    ['pose', 303],
    ['costume', 2787],
  ]) {
    const females = filterReferences(items, { kind, tag: 'female' });
    assert.equal(females.length, expected);
    assert.deepEqual(
      filterReferences(items, { kind, collection: 'builtin', tag: 'female', style: 'photo' }).map(
        (item) => item.id,
      ),
      kind === 'costume'
        ? females
            .filter((item) => !item.collection && item.tags.some((tag) => tag.id === 'photo'))
            .map((item) => item.id)
        : [],
    );
  }
  assert.equal(
    filterReferences(items, { kind: 'costume', collection: 'builtin', query: '女性 写实' }).length,
    1407,
  );
  assert.equal(
    filterReferences(items, {
      kind: 'costume',
      collection: 'builtin',
      query: 'Female Photographic',
    }).length,
    1407,
  );
  assert.equal(
    filterReferences(items, { kind: 'costume', tag: 'female', style: 'anime' }).length,
    1350,
  );
  assert.equal(filterReferences(items, { collection: 'custom', tag: 'female' }).length, 95);
  assert.equal(filterReferences(items, { tag: 'female' }).length, 4609);
});

test('sort by code follows the visible numeric code rather than the internal ID', () => {
  const a = { ...items[0], id: 'first', code: 'MP-013' };
  const b = { ...items[0], id: 'last', code: 'MP-002' };
  const source = [a, b];
  assert.deepEqual(
    sortItems(source, 'code', 'zh').map((item) => item.code),
    ['MP-002', 'MP-013'],
  );
  assert.deepEqual(source, [a, b]);
});

test('character country groups intersect with gender, style, source and bilingual search', () => {
  const japan = filterReferences(items, { kind: 'character', country: 'jp' });
  assert.equal(japan.length, 1501);
  assert.equal(filterReferences(items, { country: 'jp', collection: 'builtin' }).length, 1499);
  assert.equal(
    filterReferences(items, { country: 'jp', tag: 'female', style: 'photo' }).length,
    1500,
  );
  assert.equal(filterReferences(items, { country: 'jp', tag: 'male', style: 'photo' }).length, 1);
  assert.equal(filterReferences(items, { country: 'fr', tag: 'male', hair: 'short' }).length, 1);
  for (const country of ['fr', 'ca', 'us', 'de', 'br', 'in', 'ru', 'au', 'uk']) {
    const pair = filterReferences(items, { country });
    assert.equal(pair.length, 2);
    assert.deepEqual(
      new Set(
        pair.flatMap((item) =>
          item.tags.filter((tag) => ['male', 'female'].includes(tag.id)).map((tag) => tag.id),
        ),
      ),
      new Set(['male', 'female']),
    );
  }
  const korea = filterReferences(items, { country: 'kr' });
  assert.equal(korea.length, 1);
  assert.deepEqual(
    new Set(korea.flatMap((item) => item.tags.map((tag) => tag.id))),
    new Set(['female', 'photo']),
  );
  assert.equal(
    filterReferences(items, { country: 'international', tag: 'male', style: 'photo' }).length,
    6,
  );
  assert.equal(filterReferences(items, { kind: 'pose', country: 'jp' }).length, 0);
  assert.equal(filterReferences(items, { country: 'unknown' }).length, 0);
  for (const query of ['日本 女性 写实', 'Japan Female Photographic'])
    assert.equal(filterReferences(items, { kind: 'character', query }).length, 1500);
  assert.equal(filterReferences(items, { kind: 'character', country: 'all' }).length, 1538);
});

test('visible codes are searchable and one tag ID has one bilingual display name', () => {
  const pose = items.find((item) => item.code === 'MP-012');
  assert.ok(matchesQuery(pose, 'MP-012'));
  assert.equal(filterReferences(items, { query: 'MP-012' }).length, 1);
  assert.equal(referenceTagLabel('photo', 'en', 'Photorealistic'), 'Photographic');
  assert.equal(referenceTagLabel('photo', 'zh'), '写实');
});

// Model/dance are subject/use tags; they must not migrate into visual style.
test('model and dance links retain independent subject tags and intersect with line-art', () => {
  for (const { tag, poseCount, costumeCount, queries } of [
    { tag: 'model', poseCount: 11, costumeCount: 1, queries: ['模特', 'Model'] },
    { tag: 'dance', poseCount: 10, costumeCount: 1, queries: ['舞蹈', 'Dance'] },
  ]) {
    assert.deepEqual(readTagFilters(new URLSearchParams(`tag=${tag}&style=line-art`)), {
      tag,
      style: 'line-art',
    });
    const poses = filterReferences(items, {
      kind: 'pose',
      collection: 'custom',
      tag,
      style: 'line-art',
    });
    assert.equal(poses.length, poseCount);
    assert.ok(poses.every((item) => item.tags.some((value) => value.id === tag)));
    if (tag === 'dance')
      assert.ok(poses.every((item) => item.tags.some((value) => value.id === 'model')));
    for (const query of queries) assert.equal(filterReferences(poses, { query }).length, poseCount);
    assert.equal(
      filterReferences(items, { kind: 'costume', tag, style: 'photo' }).length,
      costumeCount,
    );
  }
  assert.equal(referenceTagLabel('model', 'zh'), '模特');
  assert.equal(referenceTagLabel('dance', 'en'), 'Dance');
});
