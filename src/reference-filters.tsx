import type { ReactNode } from 'react';
import { copy } from './i18n';
import { filterReferences, isSubjectTag, referenceTagLabel, subjectTagIds } from './library';
import type { LibraryFilters } from './library';
import type { Kind, Lang, Reference } from './types';
import { FilterSelect } from './filter-select';

const kinds: Kind[] = ['pose', 'costume', 'character'];

export function CategoryFilter({
  items,
  filters,
  lang,
  onChange,
}: {
  items: Reference[];
  filters: LibraryFilters;
  lang: Lang;
  onChange: (value: string) => void;
}) {
  const t = copy[lang];
  const counts = new Map<string, number>();
  for (const item of filterReferences(items, { ...filters, category: 'all' }))
    counts.set(item.category.id, (counts.get(item.category.id) || 0) + 1);
  const categories = [
    ...new Map(
      items
        .filter((item) => !filters.kind || filters.kind === 'all' || item.kind === filters.kind)
        .map((item) => [item.category.id, { ...item.category, kind: item.kind }]),
    ).values(),
  ];
  return (
    <div className="reference-filter-field category-filter">
      <span>{t.categoryFilter}</span>
      <FilterSelect
        label={t.categoryFilter}
        lang={lang}
        value={filters.category || 'all'}
        onChange={onChange}
        options={[
          { value: 'all', label: t.allCategories },
          ...kinds.flatMap((kind) =>
            categories
              .filter((value) => value.kind === kind)
              .map((value) => ({
                value: value.id,
                label: value[lang],
                group: t[kind],
                count: counts.get(value.id) || 0,
                disabled: !counts.get(value.id) && filters.category !== value.id,
              })),
          ),
        ]}
      />
    </div>
  );
}

export function ReferenceFilters({
  items,
  lang,
  filters,
  onCollection,
  onTag,
  onStyle,
  onCountry,
  children,
}: {
  items: Reference[];
  lang: Lang;
  filters: LibraryFilters;
  onCollection: (value: string) => void;
  onTag: (value: string) => void;
  onStyle: (value: string) => void;
  onCountry: (value: string) => void;
  children?: ReactNode;
}) {
  const t = copy[lang];
  const { collection = 'all', tag = 'all', style = 'all', country = 'all' } = filters;
  const countries = [
    ...new Map(
      items.filter((item) => item.country).map((item) => [item.country!.id, item.country!]),
    ).values(),
  ];
  const tags = [
    ...new Map(items.flatMap((item) => item.tags || []).map((value) => [value.id, value])).values(),
  ];
  const subjects = subjectTagIds.filter(
    (id) => tags.some((value) => value.id === id) || tag === id,
  );
  const styles = tags.filter((value) => !isSubjectTag(value.id));
  const count = (key: 'collection' | 'tag' | 'style' | 'country', value: string) =>
    filterReferences(items, { ...filters, [key]: value }).length;
  return (
    <div className="reference-filter-wrap">
      <div className="reference-filters">
        {children}
        <div className="reference-filter-field">
          <span>{t.collection}</span>
          <FilterSelect
            label={t.collection}
            lang={lang}
            value={collection}
            onChange={onCollection}
            options={[
              ['all', t.allCollections],
              ['builtin', t.builtinCollection],
              ['custom', t.customCollection],
            ].map(([key, label]) => ({
              value: key,
              label,
              count: count('collection', key),
              disabled: key !== 'all' && !count('collection', key) && collection !== key,
            }))}
          />
        </div>
        {(subjects.length > 0 || tag !== 'all') && (
          <div className="reference-filter-field" title={t.tagHint}>
            <span>{t.tag}</span>
            <FilterSelect
              label={t.tag}
              lang={lang}
              value={tag}
              onChange={onTag}
              options={[
                { value: 'all', label: t.allTags },
                ...subjects.map((id) => ({
                  value: id,
                  label: referenceTagLabel(id, lang),
                  count: count('tag', id),
                  disabled: !count('tag', id) && tag !== id,
                })),
              ]}
            />
          </div>
        )}
        {(styles.length > 0 || style !== 'all') && (
          <div className="reference-filter-field" title={t.styleHint}>
            <span>{t.styleFilter}</span>
            <FilterSelect
              label={t.styleFilter}
              lang={lang}
              value={style}
              onChange={onStyle}
              options={[
                { value: 'all', label: t.allStyles },
                ...styles.map((value) => ({
                  value: value.id,
                  label: referenceTagLabel(value.id, lang, value[lang]),
                  count: count('style', value.id),
                  disabled: !count('style', value.id) && style !== value.id,
                })),
                ...(style !== 'all' && !styles.some((value) => value.id === style)
                  ? [{ value: style, label: style, count: 0 }]
                  : []),
              ]}
            />
          </div>
        )}
        {(countries.length > 0 || country !== 'all') && (
          <div className="reference-filter-field">
            <span>{t.countryFilter}</span>
            <FilterSelect
              label={t.countryFilter}
              lang={lang}
              value={country}
              onChange={onCountry}
              options={[
                { value: 'all', label: t.allCountries },
                ...countries.map((value) => ({
                  value: value.id,
                  label: value[lang],
                  count: count('country', value.id),
                  disabled: !count('country', value.id) && country !== value.id,
                })),
                ...(country !== 'all' && !countries.some((value) => value.id === country)
                  ? [{ value: country, label: country, count: 0 }]
                  : []),
              ]}
            />
          </div>
        )}
      </div>
      {collection === 'custom' && (
        <details className="custom-usage-disclosure">
          <summary>{t.assetUsage}</summary>
          <p>{t.customUsageNotice}</p>
        </details>
      )}
    </div>
  );
}

export function ReferenceBadges({ item, lang }: { item: Reference; lang: Lang }) {
  if (!item.collection && !item.tags?.length && !item.country) return null;
  return (
    <div className="reference-badges">
      {item.collection === 'custom' && <span>{copy[lang].customCollection}</span>}
      {item.tags?.map((tag) => (
        <span key={tag.id}>{referenceTagLabel(tag.id, lang, tag[lang])}</span>
      ))}
      {item.country && <span>{item.country[lang]}</span>}
    </div>
  );
}
