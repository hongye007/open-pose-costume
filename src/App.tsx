import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe2,
  Grid2X2,
  Info,
  ImagePlus,
  Layers2,
  LayoutPanelLeft,
  LoaderCircle,
  PersonStanding,
  Plus,
  RotateCcw,
  Search,
  Shirt,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { copy } from './i18n';
import { Modal, RemoteImage } from './ui';
import { GenerationDialog, ImageSettings, ImageSettingsButton } from './generation-ui';
import { generationCopy } from './generation-copy';
import {
  defaultImageConfig,
  generateReferenceImage,
  ImageGenerationError,
  loadImageConfig,
  referencePrompt,
  validateCharacterFile,
} from './generation';
import type { CharacterImageReference, GenerationJob, ImageReference } from './generation';
import { angles, copyText, matchesQuery, sortItems, storageGet, storageSet } from './library';
import type { Sort, View } from './library';
import type { Catalog, Lang, Reference } from './types';

type Board = { pose?: string; costume?: string };
const initialParams = new URLSearchParams(window.location.search);
const isLanguage = (v: unknown): v is Lang => v === 'zh' || v === 'en';
const isIds = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((id) => typeof id === 'string');
const isBoard = (v: unknown): v is Board =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  ['pose', 'costume'].every(
    (k) => !(k in v) || typeof (v as Record<string, unknown>)[k] === 'string',
  );
const viewParam = initialParams.get('view');

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const value = initialParams.get('lang');
    return isLanguage(value)
      ? value
      : storageGet('opc-language', navigator.language.startsWith('zh') ? 'zh' : 'en', isLanguage);
  });
  const t = copy[lang];
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>(
    ['pose', 'costume', 'saved'].includes(viewParam || '') ? (viewParam as View) : 'all',
  );
  const [query, setQuery] = useState(initialParams.get('q') || '');
  const [category, setCategory] = useState(initialParams.get('category') || 'all');
  const [extended, setExtended] = useState(initialParams.get('extended') === '1');
  const [angle, setAngle] = useState<string>(
    angles.includes(initialParams.get('angle') as (typeof angles)[number])
      ? initialParams.get('angle')!
      : 'front',
  );
  const [sort, setSort] = useState<Sort>('curated');
  const [limit, setLimit] = useState(24);
  const [saved, setSaved] = useState(() => storageGet('opc-saved', [], isIds));
  const [board, setBoard] = useState<Board>(() => storageGet('opc-board', {}, isBoard));
  const [characterReference, setCharacterReference] = useState<CharacterImageReference | null>(
    null,
  );
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterError, setCharacterError] = useState('');
  const characterInput = useRef<HTMLInputElement>(null);
  const characterTask = useRef(0);
  const [panel, setPanel] = useState<'board' | 'about' | 'settings' | null>(null);
  const [imageConfig, setImageConfig] = useState(loadImageConfig);
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null);
  const generationController = useRef<AbortController | null>(null);
  const imageReady = !!(imageConfig.baseUrl && imageConfig.apiKey && imageConfig.model);
  const [selectedId, setSelectedId] = useState<string | null>(initialParams.get('item'));
  const [detailAngle, setDetailAngle] = useState(initialParams.get('detailAngle') || angle);
  const [toast, setToast] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw Error(`HTTP ${res.status}`);
        return res.json() as Promise<Catalog>;
      })
      .then((data) => {
        if (!data.items?.length || !data.stats) throw Error('Invalid reference catalog');
        setCatalog(data);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setFailed(true);
      });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.title =
      lang === 'zh'
        ? 'Open Pose & Costume · 姿势与服装参考库'
        : 'Open Pose & Costume · Reference studio';
    storageSet('opc-language', lang);
  }, [lang]);
  useEffect(() => {
    storageSet('opc-saved', saved);
  }, [saved]);
  useEffect(() => {
    storageSet('opc-board', board);
  }, [board]);
  useEffect(() => {
    setLimit(24);
  }, [query, view, category, extended, sort]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => () => generationController.current?.abort(), []);
  useEffect(
    () => () => {
      characterTask.current++;
    },
    [],
  );
  useEffect(() => {
    const preview = characterReference?.variant.image;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [characterReference]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = '';
    const params: Record<string, string> = {
      lang,
      view,
      ...(query ? { q: query } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(extended ? { extended: '1' } : {}),
      ...(angle !== 'front' ? { angle } : {}),
      ...(selectedId ? { item: selectedId, detailAngle } : {}),
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    window.history.replaceState(null, '', url);
  }, [lang, view, query, category, extended, angle, selectedId, detailAngle]);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  const items = catalog?.items || [];
  const eligible = useMemo(
    () => items.filter((item) => extended || !item.extended),
    [items, extended],
  );
  const byView = useMemo(
    () =>
      eligible.filter(
        (item) =>
          view === 'all' || (view === 'saved' ? saved.includes(item.id) : item.kind === view),
      ),
    [eligible, view, saved],
  );
  const categories = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const item of byView) {
      const existing = map.get(item.category.id);
      map.set(item.category.id, { label: item.category[lang], count: (existing?.count || 0) + 1 });
    }
    return [...map.entries()];
  }, [byView, lang]);
  const visible = useMemo(
    () =>
      sortItems(
        byView.filter(
          (item) =>
            (category === 'all' || item.category.id === category) && matchesQuery(item, query),
        ),
        sort,
        lang,
      ),
    [byView, category, query, sort, lang],
  );
  const selected = items.find((item) => item.id === selectedId);
  const selectedIndex = selected ? visible.findIndex((item) => item.id === selected.id) : -1;
  const variant = selected?.variants.find((v) => v.angle === detailAngle) || selected?.variants[0];
  const boardPose = items.find((item) => item.id === board.pose && item.kind === 'pose');
  const boardCostume = items.find((item) => item.id === board.costume && item.kind === 'costume');
  const boardCount = Number(!!boardPose) + Number(!!boardCostume);
  const boardPrompt =
    boardPose && boardCostume
      ? `${t.promptStart}${boardPose.title[lang]}${t.promptCostume}${boardCostume.keywords[lang]}${t.promptEnd}${characterReference ? t.promptCharacter : ''}`
      : '';
  const navItems = [
    { key: 'all' as const, label: t.all, icon: Grid2X2, count: eligible.length },
    {
      key: 'pose' as const,
      label: t.pose,
      icon: PersonStanding,
      count: eligible.filter((item) => item.kind === 'pose').length,
    },
    {
      key: 'costume' as const,
      label: t.costume,
      icon: Shirt,
      count: eligible.filter((item) => item.kind === 'costume').length,
    },
    {
      key: 'saved' as const,
      label: t.saved,
      icon: Bookmark,
      count: eligible.filter((item) => saved.includes(item.id)).length,
    },
  ];
  const pageTitle = navItems.find((item) => item.key === view)!.label;

  function changeView(next: View) {
    setView(next);
    setCategory('all');
    setQuery('');
  }
  function resetFilters() {
    setCategory('all');
    setQuery('');
    setSort('curated');
  }
  function save(item: Reference) {
    const exists = saved.includes(item.id);
    setSaved((old) => (exists ? old.filter((id) => id !== item.id) : [...old, item.id]));
    notify(exists ? t.removedToast : t.savedToast);
  }
  function addToBoard(item: Reference) {
    setBoard((old) => ({ ...old, [item.kind]: old[item.kind] === item.id ? undefined : item.id }));
    notify(t.boardToast);
  }
  function openDetail(item: Reference) {
    setDetailAngle(angle);
    setSelectedId(item.id);
  }
  const step = useCallback(
    (direction: number) => {
      const next = visible[selectedIndex + direction];
      if (selectedIndex >= 0 && next) setSelectedId(next.id);
    },
    [visible, selectedIndex],
  );
  const closeDetail = useCallback(() => setSelectedId(null), []);
  async function clipboard(value: string) {
    try {
      await copyText(value);
      notify(t.copied);
    } catch {
      notify(t.copyFailed);
    }
  }
  function closeGeneration() {
    generationController.current?.abort();
    generationController.current = null;
    setGenerationJob(null);
  }
  async function runGeneration(references: ImageReference[], prompt: string) {
    generationController.current?.abort();
    const controller = new AbortController();
    generationController.current = controller;
    const model = imageConfig.model.trim();
    setGenerationJob({ model, references, prompt, status: 'loading' });
    try {
      const result = await generateReferenceImage(
        imageConfig,
        references,
        prompt,
        controller.signal,
      );
      if (generationController.current === controller)
        setGenerationJob({ model, references, prompt, status: 'success', result });
    } catch (failure) {
      if (generationController.current !== controller || controller.signal.aborted) return;
      const t = generationCopy[lang];
      const code = failure instanceof ImageGenerationError ? failure.code : 'networkFailed';
      const summary = t[code as keyof typeof t] || t.networkFailed;
      const detail = failure instanceof ImageGenerationError ? failure.message : '';
      setGenerationJob({
        model,
        references,
        prompt,
        status: 'error',
        error: `${summary}${detail ? `\n${detail}` : ''}`,
      });
    }
  }
  async function selectCharacter(file: File) {
    const task = ++characterTask.current;
    setCharacterLoading(true);
    setCharacterError('');
    let preview = '';
    try {
      await validateCharacterFile(file);
      preview = URL.createObjectURL(file);
      const image = new Image();
      image.src = preview;
      await image.decode();
      if (task !== characterTask.current) return;
      setCharacterReference({
        kind: 'character',
        file,
        title: { zh: '人物参考', en: 'Character reference' },
        keywords: {
          zh: '保留所附人物的五官、脸型、发型发色、肤色、体型比例与画风',
          en: 'Preserve the attached character’s face, hairstyle, hair color, skin tone, proportions and visual style',
        },
        variant: {
          id: 'character-upload',
          angle: 'front',
          label: { zh: '人物', en: 'Character' },
          thumbnail: preview,
          image: preview,
          original: preview,
        },
      });
      preview = ''; // Ownership passes to the reference cleanup effect.
    } catch (error) {
      if (task === characterTask.current)
        setCharacterError(error instanceof ImageGenerationError ? error.code : 'characterInvalid');
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      if (task === characterTask.current) setCharacterLoading(false);
    }
  }
  function beginGeneration(item?: Reference) {
    if (characterLoading) return;
    const references: ImageReference[] = [];
    const add = (value: Reference | undefined, chosenVariant = value?.variants[0]) => {
      if (value && chosenVariant)
        references.push({
          kind: value.kind,
          title: value.title,
          keywords: value.keywords,
          variant: chosenVariant,
        });
    };
    if (item) {
      add(item, item.variants.find((value) => value.angle === detailAngle) || item.variants[0]);
      add(item.kind === 'pose' ? boardCostume : boardPose);
    } else {
      add(boardPose);
      add(boardCostume);
    }
    if (references.length < 2) {
      if (item) setBoard((old) => ({ ...old, [item.kind]: item.id }));
      setSelectedId(null);
      setPanel('board');
      notify(generationCopy[lang].chooseReferences);
      return;
    }
    if (characterReference) references.push(characterReference);
    void runGeneration(references, referencePrompt(references, lang));
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const isEditing =
        event.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
          event.target.isContentEditable);
      if (isEditing || generationJob) return;
      if (selectedId) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          step(-1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          step(1);
        }
      } else if (!panel && event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [selectedId, panel, step, generationJob]);

  const heroPose = items.find((item) => item.id === 'full_single_P019');
  const heroCostume =
    items.find((item) => item.id === 'SPR-0001') || items.find((item) => item.kind === 'costume');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          onClick={(e) => {
            e.preventDefault();
            changeView('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="brand-mark">
            <img
              src={`${import.meta.env.BASE_URL}brand/logo-mark.png`}
              alt=""
              width={44}
              height={44}
            />
          </span>
          <span>
            <strong>
              open<span className="brand-dot">.</span>
            </strong>
            <span className="brand-sub">POSE & COSTUME</span>
          </span>
        </a>
        <p className="nav-heading">{t.library}</p>
        <nav className="main-nav" aria-label={t.library}>
          {navItems.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              className={view === key ? 'nav-item active' : 'nav-item'}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => changeView(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              <small>{count.toLocaleString(lang)}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <p className="nav-heading">{t.workspace}</p>
        <button
          className={`nav-item board-nav ${panel === 'board' ? 'active' : ''}`}
          onClick={() => setPanel('board')}
        >
          <LayoutPanelLeft size={19} />
          <span>{t.board}</span>
          <small>{boardCount}/2</small>
        </button>
        <div className="board-invitation">
          <div className="mini-pair">
            <span>
              <PersonStanding size={27} />
            </span>
            <Plus size={13} />
            <span>
              <Shirt size={25} />
            </span>
          </div>
          <p>{t.boardHint}</p>
          <button onClick={() => setPanel('board')}>
            {t.boardOpen}
            <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="content-switch">
            <label>
              <input
                type="checkbox"
                checked={extended}
                onChange={(e) => {
                  setExtended(e.target.checked);
                  setCategory('all');
                }}
              />
              <span className="switch-track" />
              <span>{t.extended}</span>
            </label>
            <p>{t.extendedHint}</p>
          </div>
          <a
            className="social-link"
            href="https://x.com/HongyeMain"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.xProfile}
            title={t.xProfile}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933ZM17.61 20.645h2.039L6.486 3.24H4.298L17.61 20.645Z" />
            </svg>
            @HongyeMain
            <ArrowUpRight size={14} />
          </a>
          <span className="local-note">
            <span />
            {t.local}
          </span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{t.library}</span>
            <ChevronRight size={13} />
            <strong>{pageTitle}</strong>
          </div>
          <div className="header-actions">
            <ImageSettingsButton
              lang={lang}
              ready={imageReady}
              onClick={() => setPanel('settings')}
            />
            <button
              className="header-board"
              onClick={() => setPanel('board')}
              aria-label={t.boardOpen}
            >
              <LayoutPanelLeft size={17} />
              {boardCount > 0 && <small>{boardCount}</small>}
            </button>
            <button
              className="header-source"
              onClick={() => setPanel('about')}
              aria-label={t.usage}
            >
              <Info size={17} />
            </button>
            <button
              className="language-button"
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              aria-label={t.language}
            >
              <Globe2 size={16} />
              <span className={lang === 'zh' ? 'current-language' : ''}>中</span>
              <span className="language-slash">/</span>
              <span className={lang === 'en' ? 'current-language' : ''}>EN</span>
            </button>
            <span className="studio-badge">
              REFERENCE STUDIO
              <span />
            </span>
          </div>
        </header>

        <main>
          <section className="intro" aria-label={t.brand}>
            <div className="intro-copy">
              <p className="eyebrow">
                <span />
                {t.introLabel}
              </p>
              <h1>
                {t.introA}
                <br />
                <em>{t.introB}</em>
              </h1>
              <p className="intro-description">{t.introText}</p>
              <a className="intro-link" href="#collection">
                {t.introLink}
                <ArrowDown size={15} />
              </a>
            </div>
            <div className="study-shelf">
              <div className="study-label">
                <span>{t.sheet}</span>
                <Sparkles size={14} />
              </div>
              <div className="study-pair">
                {heroPose && (
                  <button
                    className="study-sheet pose-sheet"
                    onClick={() => openDetail(heroPose)}
                    aria-label={`${t.detail}: ${heroPose.title[lang]}`}
                  >
                    <span className="sheet-code">POSE / {heroPose.code}</span>
                    <RemoteImage
                      src={heroPose.variants[0].thumbnail}
                      alt={heroPose.title[lang]}
                      lang={lang}
                      eager
                    />
                    <span className="sheet-caption">
                      {t.introPose}
                      <ArrowUpRight size={13} />
                    </span>
                  </button>
                )}
                <span className="study-plus">+</span>
                {heroCostume && (
                  <button
                    className="study-sheet costume-sheet"
                    onClick={() => openDetail(heroCostume)}
                    aria-label={`${t.detail}: ${heroCostume.title[lang]}`}
                  >
                    <span className="sheet-code">LOOK / {heroCostume.code}</span>
                    <RemoteImage
                      src={heroCostume.variants[0].thumbnail}
                      alt={heroCostume.title[lang]}
                      lang={lang}
                      eager
                    />
                    <span className="sheet-caption">
                      {t.introCostume}
                      <ArrowUpRight size={13} />
                    </span>
                  </button>
                )}
              </div>
            </div>
          </section>
          <div className="collection-summary">
            <span>
              <strong>{catalog?.stats.references.toLocaleString(lang) || '—'}</strong>{' '}
              {t.referenceCount}
            </span>
            <i />
            <span>
              <strong>{catalog?.stats.images.toLocaleString(lang) || '—'}</strong> {t.viewCount}
            </span>
            <span className="summary-right">
              <Layers2 size={14} />
              POSE + COSTUME
            </span>
          </div>

          <section className="collection" id="collection" aria-labelledby="collection-heading">
            <div className="collection-header">
              <div>
                <span className="section-kicker">THE COLLECTION</span>
                <h2 id="collection-heading">
                  {pageTitle}
                  <span>{visible.length.toLocaleString(lang)}</span>
                </h2>
              </div>
            </div>
            <div className="search-row">
              <div className="search-box">
                <Search size={19} />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.search}
                  aria-label={t.search}
                />
                {query ? (
                  <button className="icon-button" aria-label={t.clear} onClick={() => setQuery('')}>
                    <X size={16} />
                  </button>
                ) : (
                  <kbd>/</kbd>
                )}
              </div>
              <label className="sort-control">
                <span>{t.sort}</span>
                <select
                  aria-label={t.sort}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                >
                  <option value="curated">{t.curated}</option>
                  <option value="name">{t.name}</option>
                  <option value="code">{t.code}</option>
                </select>
              </label>
            </div>
            <div className="category-area">
              <div className="category-chips" aria-label={t.categories}>
                <button
                  className={category === 'all' ? 'chip active' : 'chip'}
                  aria-pressed={category === 'all'}
                  onClick={() => setCategory('all')}
                >
                  {t.allCategories}
                </button>
                {categories.map(([id, { label, count }]) => (
                  <button
                    key={id}
                    className={category === id ? 'chip active' : 'chip'}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {label}
                    <small>{count}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="result-toolbar">
              <span>
                {visible.length.toLocaleString(lang)} {t.results}
                <span className="result-dot">·</span>
                <span className="regular-label">{extended ? t.extended : t.filterHint}</span>
                {(query || category !== 'all') && (
                  <button className="reset-inline" onClick={resetFilters}>
                    {t.clear}
                    <X size={12} />
                  </button>
                )}
              </span>
              {view !== 'costume' && (
                <label className="angle-control">
                  <span>{t.angle}</span>
                  <select
                    aria-label={t.angle}
                    value={angle}
                    onChange={(e) => setAngle(e.target.value)}
                  >
                    {angles.map((key) => (
                      <option key={key} value={key}>
                        {t[key]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {!catalog ? (
              <div className="status-state" role="status">
                {failed ? (
                  <>
                    <Info size={28} />
                    <h3>{t.loadError}</h3>
                    <button className="primary-button" onClick={() => setReload((v) => v + 1)}>
                      <RotateCcw size={15} />
                      {t.retry}
                    </button>
                  </>
                ) : (
                  <>
                    <LoaderCircle className="spinner" size={28} />
                    <p>{t.loading}</p>
                  </>
                )}
              </div>
            ) : visible.length === 0 ? (
              <div className="status-state">
                <div className="empty-symbol">
                  {view === 'saved' && !query && category === 'all' ? (
                    <Bookmark size={30} />
                  ) : (
                    <Search size={30} />
                  )}
                </div>
                <h3>
                  {view === 'saved' && !query && category === 'all' ? t.noSaved : t.noResults}
                </h3>
                <p>
                  {view === 'saved' && !query && category === 'all'
                    ? t.noSavedHint
                    : t.noResultsHint}
                </p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    resetFilters();
                    if (view === 'saved') changeView('all');
                  }}
                >
                  {view === 'saved' ? t.introLink : t.clear}
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="reference-grid">
                  {visible.slice(0, limit).map((item, index) => {
                    const preview =
                      item.variants.find((v) => v.angle === angle) || item.variants[0];
                    const isSaved = saved.includes(item.id);
                    return (
                      <article className={`reference-card ${item.kind}-card`} key={item.id}>
                        <div className="card-image-wrap">
                          <button
                            className="card-open"
                            onClick={() => openDetail(item)}
                            aria-label={`${t.detail}: ${item.title[lang]}`}
                          >
                            <RemoteImage
                              src={preview.thumbnail}
                              alt={item.title[lang]}
                              lang={lang}
                              eager={index < 4}
                            />
                            <span className="inspect-affordance">
                              <ArrowUpRight size={20} />
                            </span>
                          </button>
                          <span className="card-type">
                            {item.kind === 'pose' ? (
                              <PersonStanding size={13} />
                            ) : (
                              <Shirt size={13} />
                            )}{' '}
                            {item.kind === 'pose' ? 'POSE' : 'COSTUME'}
                          </span>
                          <button
                            className={`save-button ${isSaved ? 'is-saved' : ''}`}
                            aria-label={isSaved ? t.unsave : t.save}
                            aria-pressed={isSaved}
                            onClick={() => save(item)}
                          >
                            <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} />
                          </button>
                          {item.kind === 'pose' && (
                            <span className="view-count">
                              <Layers2 size={12} />
                              {item.variants.length} {t.views}
                            </span>
                          )}
                        </div>
                        <div className="card-meta">
                          <div className="card-category">
                            <span>{item.category[lang]}</span>
                            <code>{item.kind === 'pose' ? item.code : item.id}</code>
                          </div>
                          <button className="card-title" onClick={() => openDetail(item)}>
                            {item.title[lang]}
                          </button>
                          <div className="card-bottom">
                            <span>
                              {item.kind === 'pose'
                                ? preview.label[lang]
                                : item.keywords[lang].split(' ').slice(0, 3).join(' · ')}
                            </span>
                            <button
                              className={
                                board[item.kind] === item.id ? 'add-pair selected' : 'add-pair'
                              }
                              aria-label={board[item.kind] === item.id ? t.removeBoard : t.addBoard}
                              onClick={() => addToBoard(item)}
                            >
                              {board[item.kind] === item.id ? (
                                <Check size={15} />
                              ) : (
                                <Plus size={15} />
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="load-more">
                  <p>
                    {t.shown} {Math.min(limit, visible.length)} {t.of}{' '}
                    {visible.length.toLocaleString(lang)}
                  </p>
                  {limit < visible.length ? (
                    <button className="secondary-button" onClick={() => setLimit((v) => v + 24)}>
                      {t.more}
                      <ArrowDown size={15} />
                    </button>
                  ) : (
                    <span>{t.end}</span>
                  )}
                </div>
              </>
            )}
          </section>
          <footer>
            <span className="footer-wordmark">open.</span>
            <p>{t.footer}</p>
            <button onClick={() => setPanel('about')}>
              {t.usage}
              <ArrowUpRight size={13} />
            </button>
            <button
              className="back-top"
              aria-label={t.top}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              ↑
            </button>
          </footer>
        </main>
      </div>

      {selected && variant && !generationJob && (
        <Modal onClose={closeDetail} label={selected.title[lang]} className="detail-modal">
          <div className="detail-stage">
            <div className="detail-stage-top">
              <span>
                {selected.kind === 'pose' ? 'POSE STUDY' : 'COSTUME STUDY'}{' '}
                <code>/ {selected.code}</code>
              </span>
              <button
                className="icon-button detail-mobile-close"
                aria-label={t.close}
                onClick={closeDetail}
              >
                <X size={21} />
              </button>
            </div>
            <RemoteImage
              src={variant.image}
              alt={selected.title[lang]}
              lang={lang}
              className="detail-image"
              eager
              retryable
            />
            <div className="detail-pagination">
              <button
                className="icon-button"
                disabled={selectedIndex <= 0}
                aria-label={t.prev}
                onClick={() => step(-1)}
              >
                <ChevronLeft size={22} />
              </button>
              <span>
                {selectedIndex >= 0 ? `${selectedIndex + 1} / ${visible.length}` : selected.code}
              </span>
              <button
                className="icon-button"
                disabled={selectedIndex < 0 || selectedIndex >= visible.length - 1}
                aria-label={t.next}
                onClick={() => step(1)}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
          <div className="detail-info">
            <div className="detail-info-top">
              <span className="detail-category">{selected.category[lang]}</span>
              <button className="icon-button" aria-label={t.close} onClick={closeDetail}>
                <X size={21} />
              </button>
            </div>
            <code className="detail-code">{selected.id}</code>
            <h2>{selected.title[lang]}</h2>
            <p className="detail-series">{selected.series[lang]}</p>
            {selected.kind === 'pose' && (
              <div className="detail-angle-section">
                <h3>{t.angles}</h3>
                <div className="angle-buttons">
                  {selected.variants.map((v) => (
                    <button
                      key={v.id}
                      className={v.id === variant.id ? 'active' : ''}
                      aria-label={v.label[lang]}
                      aria-pressed={v.id === variant.id}
                      onClick={() => setDetailAngle(v.angle)}
                    >
                      <span className="angle-thumbnail">
                        <RemoteImage src={v.thumbnail} alt="" lang={lang} eager />
                        {v.id === variant.id && (
                          <span className="angle-selected">
                            <Check size={10} />
                          </span>
                        )}
                      </span>
                      <span className="angle-label">{v.label[lang]}</span>
                    </button>
                  ))}
                </div>
                {variant.angle !== detailAngle && <p className="angle-missing">{t.missing}</p>}
              </div>
            )}
            <div className="description-section">
              <h3>{t.keywords}</h3>
              <p>{selected.keywords[lang]}</p>
              <div className="reference-description-actions">
                <button className="text-action" onClick={() => clipboard(selected.keywords[lang])}>
                  <Copy size={14} />
                  {t.copyPrompt}
                </button>
                {imageReady && (
                  <button
                    className="text-action reference-generate"
                    disabled={characterLoading}
                    onClick={() => beginGeneration(selected)}
                  >
                    <Sparkles size={14} />
                    {generationCopy[lang].generate}
                  </button>
                )}
              </div>
            </div>
            <div className="detail-actions">
              <button className="primary-button" onClick={() => addToBoard(selected)}>
                {board[selected.kind] === selected.id ? <Check size={17} /> : <Plus size={17} />}{' '}
                {board[selected.kind] === selected.id ? t.removeBoard : t.addBoard}
              </button>
              <div className="detail-action-row">
                <button className="secondary-button" onClick={() => save(selected)}>
                  <Bookmark
                    size={16}
                    fill={saved.includes(selected.id) ? 'currentColor' : 'none'}
                  />
                  {saved.includes(selected.id) ? t.unsave : t.save}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => clipboard(window.location.href)}
                  aria-label={t.copyLink}
                  title={t.copyLink}
                >
                  <Copy size={16} />
                </button>
              </div>
              <a
                className="original-link"
                href={variant.original}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.original}
                <ExternalLink size={15} />
              </a>
              <p className="original-note">{t.originalNote}</p>
            </div>
            <p className="key-hint">{t.keys}</p>
          </div>
        </Modal>
      )}

      {panel === 'board' && !generationJob && (
        <Modal onClose={() => setPanel(null)} label={t.board} className="board-modal">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">THE PAIRING BOARD</span>
              <h2>{characterReference ? t.boardCharacterTitle : t.boardTitle}</h2>
            </div>
            <button className="icon-button" aria-label={t.close} onClick={() => setPanel(null)}>
              <X size={22} />
            </button>
          </div>
          <p className="panel-description">{t.boardDescription}</p>
          <div className="board-slots">
            {(['pose', 'costume'] as const).map((kind) => {
              const item = kind === 'pose' ? boardPose : boardCostume;
              return (
                <div className="board-slot" key={kind}>
                  <div className="board-slot-heading">
                    <span>
                      {kind === 'pose' ? <PersonStanding size={16} /> : <Shirt size={16} />}{' '}
                      {kind === 'pose' ? t.pose : t.costume}
                    </span>
                    {item && (
                      <button
                        className="icon-button"
                        aria-label={`${t.remove}: ${item.title[lang]}`}
                        onClick={() => setBoard((old) => ({ ...old, [kind]: undefined }))}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  {item ? (
                    <>
                      <RemoteImage
                        src={item.variants[0].thumbnail}
                        alt={item.title[lang]}
                        lang={lang}
                      />
                      <h3>{item.title[lang]}</h3>
                      <code>{item.id}</code>
                    </>
                  ) : (
                    <div className="board-empty">
                      {kind === 'pose' ? (
                        <PersonStanding size={46} strokeWidth={1} />
                      ) : (
                        <Shirt size={44} strokeWidth={1} />
                      )}
                      <p>{kind === 'pose' ? t.poseEmpty : t.costumeEmpty}</p>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setPanel(null);
                          changeView(kind);
                          document
                            .getElementById('collection')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {kind === 'pose' ? t.choosePose : t.chooseCostume}
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <section
            className="board-character"
            aria-label={t.characterOptional}
            aria-busy={characterLoading}
          >
            <input
              ref={characterInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={t.characterUpload}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void selectCharacter(file);
              }}
            />
            <div className="board-character-row">
              {characterReference ? (
                <img
                  className="board-character-preview"
                  src={characterReference.variant.thumbnail}
                  alt={generationCopy[lang].character}
                />
              ) : (
                <div className="board-character-placeholder">
                  <UserRound size={25} strokeWidth={1.5} />
                </div>
              )}
              <div className="board-character-description">
                <h3>{t.characterOptional}</h3>
                <p className="board-character-filename">
                  {characterReference ? characterReference.file.name : t.characterFormats}
                </p>
              </div>
              <div className="board-character-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={characterLoading}
                  onClick={() => characterInput.current?.click()}
                >
                  {characterLoading ? (
                    <LoaderCircle size={15} className="spinner" />
                  ) : (
                    <ImagePlus size={15} />
                  )}
                  {characterLoading
                    ? t.characterLoading
                    : characterReference
                      ? t.characterReplace
                      : t.characterUpload}
                </button>
                {characterReference && (
                  <button
                    type="button"
                    className="icon-button"
                    disabled={characterLoading}
                    aria-label={t.characterRemove}
                    onClick={() => {
                      setCharacterReference(null);
                      setCharacterError('');
                    }}
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
            </div>
            <p className="board-character-note">{t.characterPrivacy}</p>
            {characterError && (
              <p className="board-character-error" role="alert">
                {generationCopy[lang][characterError as keyof typeof generationCopy.zh] ||
                  generationCopy[lang].characterInvalid}
              </p>
            )}
          </section>
          <div className="board-prompt">
            <h3>{t.boardPrompt}</h3>
            <p>{boardPrompt || t.boardIncomplete}</p>
            <div className="reference-description-actions">
              <button
                className="primary-button"
                disabled={!boardPrompt}
                onClick={() => clipboard(boardPrompt)}
              >
                <Copy size={16} />
                {t.copyPrompt}
              </button>
              {imageReady && (
                <button
                  className="secondary-button"
                  disabled={characterLoading}
                  onClick={() => beginGeneration()}
                >
                  <Sparkles size={16} />
                  {generationCopy[lang].generate}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {panel === 'settings' && (
        <ImageSettings
          config={imageConfig}
          lang={lang}
          onClose={() => setPanel(null)}
          onSave={(config) => {
            setImageConfig(config);
            setPanel(null);
            notify(generationCopy[lang].saved);
          }}
          onClear={() => {
            setImageConfig({ ...defaultImageConfig });
            setPanel(null);
            notify(generationCopy[lang].cleared);
          }}
        />
      )}
      {generationJob && (
        <GenerationDialog
          job={generationJob}
          lang={lang}
          onClose={closeGeneration}
          onRun={(prompt) => void runGeneration(generationJob.references, prompt)}
        />
      )}

      {panel === 'about' && (
        <Modal onClose={() => setPanel(null)} label={t.usage} className="about-modal">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">HOW TO USE</span>
              <h2>{t.aboutTitle}</h2>
            </div>
            <button className="icon-button" aria-label={t.close} onClick={() => setPanel(null)}>
              <X size={22} />
            </button>
          </div>
          <p>{t.aboutIntro}</p>
          <h3>{t.aboutHowToTitle}</h3>
          <ul className="usage-steps">
            {t.aboutSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <h3>{t.aboutUseTitle}</h3>
          <p>
            {t.aboutUse}
            <strong className="usage-restriction">{t.aboutRestriction}</strong>
          </p>
          <p>{t.aboutRights}</p>
          <p>{t.aboutCaveat}</p>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
