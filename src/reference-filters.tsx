import { copy } from './i18n';
import type { Lang, Reference } from './types';

export function ReferenceFilters({
  items,
  lang,
  collection,
  tag,
  onCollection,
  onTag,
}: {
  items: Reference[];
  lang: Lang;
  collection: string;
  tag: string;
  onCollection: (value: string) => void;
  onTag: (value: string) => void;
}) {
  const t = copy[lang];
  const tags = [
    ...new Map(items.flatMap((item) => item.tags || []).map((value) => [value.id, value])).values(),
  ];
  return (
    <div className="reference-filter-wrap">
      <div className="reference-filters">
        <label>
          <span>{t.collection}</span>
          <select value={collection} onChange={(e) => onCollection(e.target.value)}>
            <option value="all">{t.allCollections}</option>
            <option value="builtin">{t.builtinCollection}</option>
            <option value="custom">{t.customCollection}</option>
          </select>
        </label>
        {(tags.length > 0 || tag !== 'all') && (
          <label>
            <span>{t.tag}</span>
            <select value={tag} onChange={(e) => onTag(e.target.value)}>
              <option value="all">{t.allTags}</option>
              {tags.map((value) => (
                <option key={value.id} value={value.id}>
                  {value[lang]}
                </option>
              ))}
              {tag !== 'all' && !tags.some((value) => value.id === tag) && (
                <option value={tag}>{tag}</option>
              )}
            </select>
          </label>
        )}
      </div>
      {collection === 'custom' && <p className="custom-usage-notice">{t.customUsageNotice}</p>}
    </div>
  );
}

export function ReferenceBadges({ item, lang }: { item: Reference; lang: Lang }) {
  if (!item.collection && !item.tags?.length) return null;
  return (
    <div className="reference-badges">
      {item.collection === 'custom' && <span>{copy[lang].customCollection}</span>}
      {item.tags?.map((tag) => (
        <span key={tag.id}>{tag[lang]}</span>
      ))}
    </div>
  );
}
