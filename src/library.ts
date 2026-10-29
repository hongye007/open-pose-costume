import type { Lang, Reference } from './types';
import vocabulary from '../data/vocabulary.json';

export type View = 'all' | 'pose' | 'costume' | 'saved';
export type Sort = 'curated' | 'name' | 'code';
export const angles = ['front', 'high', 'low', 'side', 'diag'] as const;
const chineseTerms = [...new Set(Object.values(vocabulary.costume))].sort(
  (a, b) => b.length - a.length,
);

function searchWords(query: string): string[] {
  return query
    .toLocaleLowerCase()
    .normalize('NFKC')
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      if (!/^[\u3400-\u9fff]+$/.test(word)) return [word === 'gray' ? 'grey' : word];
      const words: string[] = [];
      let remaining = word;
      while (remaining) {
        const match = chineseTerms.find((term) => remaining.startsWith(term));
        if (!match) return [word];
        words.push(match);
        remaining = remaining.slice(match.length);
      }
      return words;
    });
}

export function matchesQuery(item: Reference, query: string): boolean {
  const haystack = [
    item.id,
    item.title.zh,
    item.title.en,
    item.keywords.zh,
    item.keywords.en,
    item.category.zh,
    item.category.en,
    item.series.zh,
    item.series.en,
  ]
    .join(' ')
    .toLocaleLowerCase()
    .normalize('NFKC');
  return searchWords(query).every((word) => haystack.includes(word));
}

export function sortItems(items: Reference[], sort: Sort, lang: Lang): Reference[] {
  if (sort !== 'curated')
    return [...items].sort((a, b) =>
      sort === 'code'
        ? a.id.localeCompare(b.id, undefined, { numeric: true })
        : a.title[lang].localeCompare(b.title[lang], lang === 'zh' ? 'zh-CN' : 'en'),
    );
  const poses = items.filter((item) => item.kind === 'pose');
  const costumes = items.filter((item) => item.kind === 'costume');
  const mixed: Reference[] = [];
  for (let i = 0; i < Math.max(poses.length, costumes.length); i++) {
    if (poses[i]) mixed.push(poses[i]);
    if (costumes[i]) mixed.push(costumes[i]);
  }
  return mixed;
}

export function storageGet<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || 'null');
    return validate(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep the in-memory workspace usable when storage is unavailable. */
  }
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* Fall back for browser permissions. */
    }
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  const activeDialog = document.querySelector('dialog[open]');
  (activeDialog || document.body).append(input);
  input.select();
  try {
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    input.remove();
  }
}
