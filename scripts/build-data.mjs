import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const root = new URL('../', import.meta.url);
export const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

export async function normalize(pose, costume, chinese) {
  const vocabulary = await readJson('data/vocabulary.json');
  const titles = await readJson('data/pose-titles.en.json');
  const zh = new Map(chinese.map((row) => [row.id, row]));
  const groups = new Map();
  const used = new Set();
  const category = (key) => {
    if (!vocabulary.categories[key]) throw Error(`Missing category translation: ${key}`);
    return vocabulary.categories[key];
  };
  const remote = (origin, path) => {
    const url = new URL(path, origin);
    if (url.origin !== origin || !/\.(jpg|png|webp)$/.test(url.pathname))
      throw Error(`Unexpected image address: ${path}`);
    return url.href;
  };
  for (const row of pose) {
    if (used.has(row.id)) throw Error(`Duplicate ID: ${row.id}`);
    used.add(row.id);
    const id = row.id.replace(/_(front|high|low|side|diag)$/, '');
    const prefix = id.replace(/_P\d+$/, '');
    const number = row['ポーズ番号'].slice(1);
    const en = Array.isArray(titles[prefix])
      ? titles[prefix][Number(number) - 1]
      : titles[prefix]?.[number];
    const translated = zh.get(row.id)?.['姿势名称'];
    if (
      !en ||
      !translated ||
      !vocabulary.angles[row['アングル']] ||
      !vocabulary.series[row['系統']]
    ) {
      throw Error(
        `Missing translation for ${row.id}; update data/pose-titles.en.json or source/pose-zh.json`,
      );
    }
    if (!groups.has(id))
      groups.set(id, {
        id,
        kind: 'pose',
        code: row['ポーズ番号'],
        title: { zh: translated, en },
        category: category(row['分類']),
        series: vocabulary.series[row['系統']],
        extended:
          prefix === 'full_sexy' ||
          prefix === 'pair60' ||
          (prefix === 'upper80v2' && Number(number) > 25),
        keywords: { zh: translated, en },
        source: 'https://ai-pose-gallery.pages.dev/',
        variants: [],
      });
    groups.get(id).variants.push({
      id: row.id,
      angle: row.id.split('_').at(-1),
      label: vocabulary.angles[row['アングル']],
      thumbnail: remote('https://ai-pose-gallery.pages.dev', row['サムネ']),
      image: remote('https://ai-pose-gallery.pages.dev', row['原寸']),
      original: remote('https://ai-pose-gallery.pages.dev', row['原寸']),
    });
  }
  const outfits = costume.map((row) => {
    if (used.has(row.id)) throw Error(`Duplicate ID: ${row.id}`);
    used.add(row.id);
    const tokens = row['キーワード'].split(/\s+/);
    const translated = tokens.map((word) => {
      if (!vocabulary.costume[word]) throw Error(`Missing costume translation: ${word}`);
      return vocabulary.costume[word];
    });
    const cat = category(row['カテゴリ']);
    const en = tokens.join(' ');
    const garments = new Set([
      'apron',
      'blouse',
      'bra',
      'briefs',
      'camisole',
      'cardigan',
      'coat',
      'corset',
      'dress',
      'hoodie',
      'jacket',
      'jeans',
      'pants',
      'robe',
      'shirt',
      'shorts',
      'skirt',
      'sweater',
      'swimsuit',
      'vest',
    ]);
    const phrases = [];
    let lastGarment = -1;
    for (let index = 0; index < tokens.length && phrases.length < 2; index++) {
      if (!garments.has(tokens[index])) continue;
      phrases.push(tokens.slice(Math.max(lastGarment + 1, index - 3), index + 1));
      lastGarment = index;
    }
    const titleEn = phrases.length ? phrases.map((words) => words.join(' ')).join(' / ') : en;
    const titleZh = phrases.length
      ? phrases.map((words) => words.map((word) => vocabulary.costume[word]).join('')).join(' · ')
      : translated.join(' · ');
    return {
      id: row.id,
      kind: 'costume',
      code: row.id,
      title: { zh: titleZh, en: titleEn[0].toUpperCase() + titleEn.slice(1) },
      category: cat,
      series: { zh: '服装参考', en: 'Costume reference' },
      extended: ['lingerie', 'swimwear', 'expressive-outfits'].includes(cat.id),
      keywords: { zh: translated.join(' '), en },
      source: 'https://ai-costume-gallery.pages.dev/',
      variants: [
        {
          id: row.id,
          angle: 'front',
          label: { zh: '正面', en: 'Front' },
          thumbnail: remote('https://ai-costume-gallery.pages.dev', row['サムネ']),
          image: remote('https://ai-costume-gallery.pages.dev', row['画像']),
          original: remote('https://ai-costume-gallery.pages.dev', row['原寸']),
        },
      ],
    };
  });
  // Start with foundational poses; retain every source record, including the one incomplete angle set.
  const poses = [...groups.values()].sort((a, b) => Number(a.extended) - Number(b.extended));
  return {
    items: [...poses, ...outfits],
    stats: {
      poseGroups: poses.length,
      poseImages: pose.length,
      costumes: outfits.length,
      references: poses.length + outfits.length,
      images: pose.length + outfits.length,
    },
  };
}

export async function saveCatalog(catalog) {
  await mkdir(new URL('public/data/', root), { recursive: true });
  await writeFile(new URL('public/data/catalog.json', root), JSON.stringify(catalog));
  console.log(JSON.stringify(catalog.stats, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await saveCatalog(
    await normalize(
      ...(await Promise.all(
        ['pose', 'costume', 'pose-zh'].map((name) => readJson(`data/source/${name}.json`)),
      )),
    ),
  );
}
