import { readFile, access } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

// Custom extensions are independent of upstream snapshots and survive every sync.
export async function loadCustomReferences(existing = []) {
  const used = new Set(existing.map((item) => item.id));
  const variants = new Set(existing.flatMap((item) => item.variants.map((v) => v.id)));
  const items = [];
  for (const kind of ['pose', 'costume', 'character']) {
    const rows = JSON.parse(await readFile(new URL(`data/custom/${kind}.json`, root), 'utf8'));
    if (!Array.isArray(rows)) throw Error(`Invalid custom ${kind} manifest`);
    for (const item of rows) {
      if (
        item.kind !== kind ||
        item.collection !== 'custom' ||
        !new RegExp(`^custom_${kind}_[a-z0-9_]+$`).test(item.id) ||
        used.has(item.id)
      )
        throw Error(`Invalid or duplicate custom ID: ${item.id}`);
      used.add(item.id);
      for (const value of [
        item.title,
        item.category,
        item.series,
        item.keywords,
        ...(item.tags || []),
      ])
        if (!value?.zh?.trim() || !value?.en?.trim())
          throw Error(`Missing custom translation: ${item.id}`);
      if (!item.category.id || typeof item.extended !== 'boolean' || !item.variants?.length)
        throw Error(`Incomplete custom reference: ${item.id}`);
      for (const variant of item.variants) {
        if (
          !/^[a-zA-Z0-9_-]+$/.test(variant.id) ||
          variants.has(variant.id) ||
          !variant.angle ||
          !variant.label?.zh ||
          !variant.label?.en
        )
          throw Error(`Invalid custom variant: ${item.id}`);
        variants.add(variant.id);
        for (const [key, folder] of [
          ['thumbnail', 'thumbnails'],
          ['image', 'images'],
          ['original', 'originals'],
        ]) {
          if (
            !new RegExp(`^custom/${kind}/${folder}/[a-zA-Z0-9_-]+\\.(png|jpg|webp)$`).test(
              variant[key],
            )
          )
            throw Error(`Unsafe custom asset: ${item.id} ${key}`);
          await access(new URL(`public/${variant[key]}`, root));
        }
      }
      items.push(item);
    }
  }
  return items;
}
