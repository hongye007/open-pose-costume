import type { Lang, Reference } from './types';
import vocabulary from '../data/vocabulary.json';

export type View = 'all' | 'pose' | 'costume' | 'character' | 'saved' | 'studio';
export type Sort = 'curated' | 'name' | 'code';
export const angles = ['front', 'high', 'low', 'side', 'diag'] as const;
export const subjectTagIds = ['female', 'male'] as const;
export function isSubjectTag(id: string) {
  return subjectTagIds.some((value) => value === id);
}
const tagVocabulary: Record<string, { zh: string; en: string }> = {
  female: { zh: '女性', en: 'Female' },
  male: { zh: '男性', en: 'Male' },
  photo: { zh: '写实', en: 'Photographic' },
  anime: { zh: '动漫', en: 'Anime' },
  'line-art': { zh: '结构线稿', en: 'Structural line art' },
};
export function referenceTagLabel(id: string, lang: Lang, fallback?: string) {
  return tagVocabulary[id]?.[lang] || fallback || id;
}
export interface LibraryFilters {
  category?: string;
  collection?: string;
  tag?: string;
  style?: string;
  country?: string;
  query?: string;
  hair?: string;
  kind?: string;
}

// Older links stored both subject and visual styles in the same tag parameter.
export function readTagFilters(params: URLSearchParams) {
  const legacy = params.get('tag') || 'all';
  return {
    tag: isSubjectTag(legacy) ? legacy : 'all',
    style: params.get('style') || (!isSubjectTag(legacy) ? legacy : 'all'),
  };
}

export function filterReferences(items: Reference[], filters: LibraryFilters): Reference[] {
  const {
    category = 'all',
    collection = 'all',
    tag = 'all',
    style = 'all',
    country = 'all',
    query = '',
    hair = 'all',
    kind = 'all',
  } = filters;
  return items.filter(
    (item) =>
      (kind === 'all' || item.kind === kind) &&
      (category === 'all' || item.category.id === category) &&
      (hair === 'all' || item.portrait?.hair === hair) &&
      matchesExtension(item, collection, tag) &&
      (style === 'all' || !!item.tags?.some((value) => value.id === style)) &&
      (country === 'all' || item.country?.id === country) &&
      matchesQuery(item, query),
  );
}
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
    item.code,
    item.title.zh,
    item.title.en,
    item.keywords.zh,
    item.keywords.en,
    item.category.zh,
    item.category.en,
    item.series.zh,
    item.series.en,
    ...(item.country ? [item.country.id, item.country.zh, item.country.en] : []),
    ...(item.collection === 'custom' ? ['自建扩展', 'Custom'] : []),
    ...(item.tags || []).flatMap((tag) => [tag.id, tag.zh, tag.en]),
  ]
    .join(' ')
    .toLocaleLowerCase()
    .normalize('NFKC');
  return searchWords(query).every((word) => haystack.includes(word));
}

export function matchesExtension(item: Reference, collection: string, tag: string): boolean {
  return (
    (collection === 'all' ||
      (collection === 'custom' ? item.collection === 'custom' : !item.collection)) &&
    (tag === 'all' || !!item.tags?.some((value) => value.id === tag))
  );
}

export function sortItems(items: Reference[], sort: Sort, lang: Lang): Reference[] {
  if (sort !== 'curated')
    return [...items].sort((a, b) =>
      sort === 'code'
        ? a.code.localeCompare(b.code, undefined, { numeric: true }) ||
          a.id.localeCompare(b.id, undefined, { numeric: true })
        : a.title[lang].localeCompare(b.title[lang], lang === 'zh' ? 'zh-CN' : 'en'),
    );
  const poses = items.filter((item) => item.kind === 'pose');
  const costumes = items.filter((item) => item.kind === 'costume');
  const characters = items.filter((item) => item.kind === 'character');
  const mixed: Reference[] = [];
  for (let i = 0; i < Math.max(poses.length, costumes.length, characters.length); i++) {
    if (poses[i]) mixed.push(poses[i]);
    if (costumes[i]) mixed.push(costumes[i]);
    if (characters[i]) mixed.push(characters[i]);
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
