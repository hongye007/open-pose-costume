// check-es.mjs — Spanish-layer coverage guard for the es branch.
// Usage: node scripts/check-es.mjs
// Exit 0: every upstream key has a Spanish counterpart.
// Exit 1: lists what is missing (translate ONLY those entries).
// The app itself never breaks on a missing entry: catalog fields fall back
// to English at build time and the runtime fills any remaining gap, so this
// check is a translation TODO list, not a build blocker for local work.
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const missing = [];
const check = (label, expected, actual) => {
  for (const key of expected) if (!(key in actual)) missing.push(`${label}: ${key}`);
};

// --- UI copy: top-level keys of the English object vs the Spanish overlay ---
const topKeys = (text, block) => {
  const part = text.split(`  ${block}: {`, 1)[1] || '';
  const keys = [];
  for (const line of part.split('\n')) {
    const m = line.match(/^    ([A-Za-z0-9_]+):/);
    if (m) keys.push(m[1]);
    if (/^  },?$/.test(line)) break;
  }
  return keys;
};
const esKeys = (text) => {
  const keys = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^  ([A-Za-z0-9_]+):/);
    if (m) keys.push(m[1]);
  }
  return keys;
};
for (const [file, overlay, block] of [
  ['src/i18n.ts', 'src/i18n-es.ts', 'en'],
  ['src/generation-copy.ts', 'src/generation-copy-es.ts', 'en'],
  ['src/studio-copy.ts', 'src/studio-copy-es.ts', 'en'],
]) {
  const orig = await readFile(new URL(file, root), 'utf8');
  const es = await readFile(new URL(overlay, root), 'utf8');
  check(`${overlay} keys`, topKeys(orig, block), Object.fromEntries(esKeys(es).map((k) => [k, 1])));
}

// --- Catalog vocabulary ---
const vocab = await readJson('data/vocabulary.json');
const vocabEs = await readJson('data/vocabulary-es.json');
for (const section of ['costume', 'series', 'angles']) check(`vocabulary-es.${section}`, Object.keys(vocab[section]), vocabEs[section] || {});
check('vocabulary-es.categories', Object.keys(vocab.categories), vocabEs.categories || {});

// --- Pose titles: same prefixes, same lengths / keys ---
const titlesEn = await readJson('data/pose-titles.en.json');
const titlesEs = await readJson('data/pose-titles.es.json');
for (const [prefix, value] of Object.entries(titlesEn)) {
  const es = titlesEs[prefix];
  if (!es) { missing.push(`pose-titles.es: ${prefix} (entire group)`); continue; }
  const enKeys = Array.isArray(value) ? value.map((_, i) => i) : Object.keys(value);
  const esKeysList = Array.isArray(es) ? es.map((_, i) => i) : Object.keys(es);
  if (enKeys.length !== esKeysList.length) missing.push(`pose-titles.es: ${prefix} length ${enKeys.length} vs ${esKeysList.length}`);
  for (const k of enKeys) if (!(k in es)) missing.push(`pose-titles.es: ${prefix}.${k}`);
}

// --- Portrait styles ---
const styles = await readJson('data/portrait-styles.json');
const stylesEs = await readJson('data/portrait-styles-es.json');
check('portrait-styles-es', Object.keys(styles), stylesEs);

if (missing.length) {
  console.log('Spanish layer: MISSING TRANSLATIONS');
  for (const line of missing) console.log(` - ${line}`);
  console.log(`\n${missing.length} missing. The app still works (English fallback); translate only these.`);
  process.exit(1);
}
console.log('Spanish layer: complete (UI copy, vocabulary, pose titles, portrait styles).');
