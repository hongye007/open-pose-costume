import { readFile } from 'node:fs/promises';

export const portraitOrigin = 'https://ai-portrait-gallery.pages.dev';
export const hairLabels = {
  ショート: { id: 'short', zh: '短发', en: 'Short hair', es: 'Cabello corto' },
  ミディアム: { id: 'medium', zh: '中发', en: 'Medium hair', es: 'Cabello medio' },
  セミロング: { id: 'medium-long', zh: '中长发', en: 'Medium-long hair', es: 'Cabello medio-largo' },
  ロング: { id: 'long', zh: '长发', en: 'Long hair', es: 'Cabello largo' },
};

export async function normalizePortraits(rows) {
  const styles = JSON.parse(
    await readFile(new URL('../data/portrait-styles.json', import.meta.url), 'utf8'),
  );
  // Spanish overlay, same rule as build-data: missing style -> English, never a build failure.
  let stylesEs = {};
  try {
    stylesEs = JSON.parse(
      await readFile(new URL('../data/portrait-styles-es.json', import.meta.url), 'utf8'),
    );
  } catch {
    stylesEs = {};
  }
  const used = new Set();
  return rows.map((row) => {
    const hair = hairLabels[row.hair];
    const face = row.section === 'face';
    const style = row.style ? styles[row.style] : null;
    if (
      !/^f[a-f0-9]+$/.test(row.id) ||
      used.has(row.id) ||
      !['face', 'styling'].includes(row.section) ||
      !hair ||
      (row.style && !style) ||
      !Number.isInteger(row.w) ||
      row.w < 1 ||
      !Number.isInteger(row.h) ||
      row.h < 1
    )
      throw Error(`Invalid portrait or missing translation: ${row.id}`);
    used.add(row.id);
    const imageUrl = (path, extension) => {
      if (path !== `img/${extension === 'png' ? 'full' : 'thumb'}/${row.id}.${extension}`)
        throw Error(`Unexpected portrait image address: ${path}`);
      return new URL(path, `${portraitOrigin}/`).href;
    };
    const category = face
      ? { id: 'portrait-face', zh: '人脸', en: 'Face', es: 'Rostro' }
      : { id: 'portrait-styling', zh: '人物造型', en: 'Styling', es: 'Estilismo' };
    const styleEs = row.style ? stylesEs[row.style] || style?.en : null;
    const title = {
      zh: `${style?.zh || hair.zh} · ${category.zh}`,
      en: `${style?.en || hair.en} · ${category.en}`,
      es: `${styleEs || hair.es} · ${category.es}`,
    };
    const original = imageUrl(row.full, 'png');
    return {
      id: `portrait-${row.id}`,
      kind: 'character',
      code: row.id,
      title,
      category,
      series: { zh: hair.zh, en: hair.en, es: hair.es },
      extended: false,
      // The existing portrait collection is female and photographic, as confirmed by the curator.
      tags: [
        { id: 'female', zh: '女性', en: 'Female', es: 'Femenino' },
        { id: 'photo', zh: '写实', en: 'Photographic', es: 'Fotográfico' },
      ],
      country: { id: 'jp', zh: '日本', en: 'Japan', es: 'Japón' },
      keywords: {
        zh: `${title.zh}。AI 虚构人物参考，保留人物五官、脸型、发型发色与肤色，不采用参考中的服装或动作。`,
        en: `${title.en}. Fictional AI character reference. Preserve face, hairstyle, hair color and skin tone, without adopting the reference outfit or pose.`,
        es: `${title.es}. Referencia de personaje ficticio generada por IA. Conserva rostro, peinado, color de cabello y tono de piel, sin adoptar el atuendo ni la pose de la referencia.`,
      },
      source: `${portraitOrigin}/`,
      portrait: { section: row.section, hair: hair.id },
      variants: [
        {
          id: row.id,
          angle: 'front',
          label: { zh: category.zh, en: category.en, es: category.es },
          thumbnail: imageUrl(row.thumb, 'webp'),
          image: original,
          original,
        },
      ],
    };
  });
}
