import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { root, normalize, saveCatalog, readJson } from './build-data.mjs';

const sources = {
  pose: 'https://ai-pose-gallery.pages.dev/',
  costume: 'https://ai-costume-gallery.pages.dev/',
  'pose-zh': 'https://raw.githubusercontent.com/anhao/ai-pose-gallery-zh/main/data/pose-zh.json',
  portrait: 'https://ai-portrait-gallery.pages.dev/data/images.js',
};
export function extractDataset(html, marker = /\bconst\s+D\s*=\s*/) {
  // Parse JSON literals only. Never execute source-site scripts.
  const start = html.match(marker);
  if (!start) throw Error('Source dataset marker not found; review the source site format');
  const rest = html.slice(start.index + start[0].length);
  let quote = false,
    escaped = false,
    depth = 0;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote && ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      quote = !quote;
      continue;
    }
    if (quote) continue;
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(rest.slice(0, i + 1));
    }
  }
  throw Error('Source JSON is incomplete');
}

async function fetchText(url) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'OpenPoseCostume/0.1 (metadata index only)' },
      });
      if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const portraitOnly = process.argv.includes('--portrait-only');
  const entries = await Promise.all(
    Object.entries(sources)
      .filter(([name]) => !portraitOnly || name === 'portrait')
      .map(async ([name, url]) => {
        const text = await fetchText(url);
        const rows =
          name === 'pose-zh'
            ? JSON.parse(text)
            : extractDataset(
                text,
                name === 'portrait' ? /\bwindow\.GALLERY_IMAGES\s*=\s*/ : undefined,
              );
        if (!Array.isArray(rows) || !rows.length) throw Error(`Empty dataset from ${url}`);
        return [name, rows];
      }),
  );
  const datasets = Object.fromEntries(entries);
  if (portraitOnly)
    for (const name of ['pose', 'costume', 'pose-zh'])
      datasets[name] = await readJson(`data/source/${name}.json`);
  // Validate all translations before replacing any local snapshots.
  const catalog = await normalize(
    datasets.pose,
    datasets.costume,
    datasets['pose-zh'],
    datasets.portrait,
  );
  const previous = portraitOnly ? await readJson('data/sync-manifest.json') : { sources: [] };
  const manifest = {
    syncedAt: new Date().toISOString(),
    imagesDownloaded: 0,
    sources: [
      ...previous.sources.filter((source) => !entries.some(([name]) => name === source.name)),
      ...entries.map(([name, rows]) => ({
        name,
        url: sources[name],
        records: rows.length,
        sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      })),
    ],
  };
  for (const [name, rows] of entries)
    await writeFile(new URL(`data/source/${name}.json`, root), JSON.stringify(rows));
  await writeFile(
    new URL('data/sync-manifest.json', root),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  await saveCatalog(catalog);
  console.log('Synced metadata only. No images were downloaded.');
}
