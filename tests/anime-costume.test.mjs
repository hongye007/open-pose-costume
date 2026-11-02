import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { normalize, readJson } from '../scripts/build-data.mjs';

const rows = await readJson('data/source/costume-anime.json');
const catalog = await readJson('public/data/catalog.json');
const origin = 'https://ai-costume-anime-gallery.pages.dev';
const anime = catalog.items.filter((item) => item.source === `${origin}/`);
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: 'custom',
});
const { filterReferences, matchesQuery } = await vite.ssrLoadModule('/src/library.ts');
const generation = await vite.ssrLoadModule('/src/generation.ts');
after(() => vite.close());

test('anime costumes preserve all source IDs, categories and image URLs with independent identities', () => {
  assert.equal(rows.length, 1320);
  assert.equal(anime.length, rows.length);
  assert.equal(new Set(anime.map((item) => item.id)).size, rows.length);
  const counts = {};
  for (const [index, item] of anime.entries()) {
    const row = rows[index];
    assert.equal(item.id, `anime_costume_${row.id}`);
    assert.equal(item.code, `ANIME-${row.id}`);
    assert.ok(
      catalog.items.some(
        (photo) => photo.id === row.id && photo.tags.some((tag) => tag.id === 'photo'),
      ),
    );
    assert.deepEqual(
      item.tags.map((tag) => tag.id),
      ['female', 'anime'],
    );
    assert.equal(item.collection, undefined);
    assert.equal(item.variants.length, 1);
    for (const [field, sourceField] of [
      ['thumbnail', 'サムネ'],
      ['image', '画像'],
      ['original', '原寸'],
    ])
      assert.equal(item.variants[0][field], new URL(row[sourceField], origin).href);
    counts[item.category.id] = (counts[item.category.id] || 0) + 1;
    assert.equal(
      item.extended,
      ['lingerie', 'swimwear', 'expressive-outfits'].includes(item.category.id),
    );
    assert.ok(matchesQuery(item, '女性 动漫'));
    assert.ok(matchesQuery(item, 'Female Anime'));
    assert.ok(matchesQuery(item, item.code));
  }
  assert.deepEqual(counts, {
    spring: 197,
    summer: 237,
    autumn: 230,
    winter: 232,
    lingerie: 197,
    party: 36,
    swimwear: 52,
    'expressive-outfits': 139,
  });
  assert.equal(
    filterReferences(catalog.items, { kind: 'costume', style: 'anime', collection: 'builtin' })
      .length,
    1320,
  );
  assert.equal(
    filterReferences(catalog.items, { kind: 'costume', style: 'anime', collection: 'custom' })
      .length,
    30,
  );
  assert.equal(
    filterReferences(anime, { category: 'winter', style: 'anime', tag: 'female' }).length,
    232,
  );
  assert.equal(filterReferences(anime, { style: 'photo' }).length, 0);
});

test('anime ingestion rejects duplicate IDs, foreign images and missing translations', async () => {
  await assert.rejects(normalize([], [], [], [], [rows[0], rows[0]]), /Duplicate ID/);
  for (const field of ['サムネ', '画像', '原寸'])
    await assert.rejects(
      normalize([], [], [], [], [{ ...rows[0], [field]: 'https://other.example/image.png' }]),
      /Unexpected image address/,
    );
  await assert.rejects(
    normalize([], [], [], [], [{ ...rows[0], キーワード: 'unknown-garment' }]),
    /Missing costume translation/,
  );
});

test('anime generation fetches the selected PNG original and permits its origin only for costumes', async () => {
  const item = anime[0];
  const reference = {
    kind: 'costume',
    title: item.title,
    keywords: item.keywords,
    variant: item.variants[0],
  };
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const requests = [];
  const result = await generation.generateReferenceImage(
    { ...generation.defaultImageConfig, apiKey: 'test-key' },
    [reference],
    'test',
    new AbortController().signal,
    async (url, options) => {
      requests.push({ url, options });
      if (options.method === 'POST') {
        const files = options.body.getAll('image[]');
        assert.equal(files.length, 1);
        assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()), png);
        return Response.json({ data: [{ url: 'https://result.example/image.png' }] });
      }
      assert.equal(url, reference.variant.original);
      assert.equal(options.headers, undefined);
      return new Response(png, { headers: { 'Content-Type': 'image/png' } });
    },
  );
  assert.equal(result, 'https://result.example/image.png');
  assert.equal(requests.length, 2);
  for (const kind of ['pose', 'character'])
    await assert.rejects(
      generation.generateReferenceImage(
        { ...generation.defaultImageConfig, apiKey: 'test-key' },
        [{ ...reference, kind }],
        'test',
        new AbortController().signal,
        async () => {
          throw Error('must not fetch');
        },
      ),
      (error) => error.code === 'referenceFailed',
    );
});
