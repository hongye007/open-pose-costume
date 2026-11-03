import { downloadFilename } from './download-filename';
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
  Download,
  ExternalLink,
  Globe2,
  Github,
  Grid2X2,
  Info,
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
import { HeroStudy } from './hero-study';
import { hasPoseDepth, isDepthVariant, withPoseDepth } from './pose-depth';
import { Modal, RemoteImage } from './ui';
import { ImageSettings, ImageSettingsButton } from './generation-ui';
import { GenerationStudio } from './generation-studio';
import { studioCopy } from './studio-copy';
import { extractCostume } from './costume-extraction';
import { CostumeExtractionDialog } from './costume-extraction-ui';
import { generationCopy } from './generation-copy';
import {
  defaultImageConfig,
  generateReferenceImage,
  ImageGenerationError,
  loadImageConfig,
  normalizeImageConfig,
  validateReferenceFile,
} from './generation';
import type {
  UploadedImageReference,
  GenerationJob,
  ImageConfig,
  ImageReference,
} from './generation';
import {
  angles,
  copyText,
  filterReferences,
  readTagFilters,
  referenceTagLabel,
  sortItems,
  storageGet,
  storageSet,
} from './library';
import { resolveCustomAssets } from './custom-assets';
import { ReferenceFilters, ReferenceBadges, CategoryFilter } from './reference-filters';
import { FilterSelect } from './filter-select';
import type { Sort, View } from './library';
import type { Catalog, Lang, Reference, Variant } from './types';

type Board = { pose?: string; costume?: string; character?: string };
const initialParams = new URLSearchParams(window.location.search);
const isLanguage = (v: unknown): v is Lang => v === 'zh' || v === 'en';
const isIds = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((id) => typeof id === 'string');
const isBoard = (v: unknown): v is Board =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  ['pose', 'costume', 'character'].every(
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
  const [showDomainNotice, setShowDomainNotice] = useState(() =>
    window.location.hostname === 'hongye007.github.io' &&
    !storageGet('opc-domain-notice-opt-out-v2', false, (value): value is boolean => typeof value === 'boolean'),
  );
  const [domainNoticeOptOut, setDomainNoticeOptOut] = useState(false);
  const dismissDomainNotice = () => {
    if (domainNoticeOptOut) storageSet('opc-domain-notice-opt-out-v2', true);
    setShowDomainNotice(false);
  };
  const newDomainUrl = `https://omilic.com/${window.location.search}${window.location.hash}`;

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<View>(
    ['pose', 'costume', 'character', 'saved', 'studio'].includes(viewParam || '')
      ? (viewParam as View)
      : 'all',
  );
  const [query, setQuery] = useState(initialParams.get('q') || '');
  const [category, setCategory] = useState(initialParams.get('category') || 'all');
  const [hair, setHair] = useState(initialParams.get('hair') || 'all');
  const [collection, setCollection] = useState(
    initialParams.get('collection') === 'custom'
      ? 'custom'
      : initialParams.get('collection') === 'builtin'
        ? 'builtin'
        : 'all',
  );
  const [tag, setTag] = useState(readTagFilters(initialParams).tag);
  const [style, setStyle] = useState(readTagFilters(initialParams).style);
  const [country, setCountry] = useState(initialParams.get('country') || 'all');
  const [kind, setKind] = useState(
    viewParam === 'saved' &&
      ['pose', 'costume', 'character'].includes(initialParams.get('kind') || '')
      ? initialParams.get('kind')!
      : 'all',
  );
  const [extended, setExtended] = useState(initialParams.get('extended') === '1');
  const [poseDepth, setPoseDepth] = useState(initialParams.get('depth') === '1');
  const angle = angles.includes(initialParams.get('angle') as (typeof angles)[number])
    ? initialParams.get('angle')!
    : 'front';
  const [cardAngles, setCardAngles] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<Sort>(
    ['name', 'code'].includes(initialParams.get('sort') || '')
      ? (initialParams.get('sort') as Sort)
      : 'curated',
  );
  const [limit, setLimit] = useState(24);
  const [saved, setSaved] = useState(() => storageGet('opc-saved', [], isIds));
  const [board, setBoard] = useState<Board>(() => storageGet('opc-board', {}, isBoard));
  const [characterReference, setCharacterReference] = useState<UploadedImageReference | null>(null);
  const [costumeReference, setCostumeReference] = useState<UploadedImageReference | null>(null);
  const [costumeLoading, setCostumeLoading] = useState(false);
  const [pendingCostume, setPendingCostume] = useState<File | null>(null);
  const [costumeDialogOpen, setCostumeDialogOpen] = useState(false);
  const [extractedCostume, setExtractedCostume] = useState<File | null>(null);
  const [extractionError, setExtractionError] = useState('');
  const costumeController = useRef<AbortController | null>(null);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterError, setCharacterError] = useState('');
  const [studioAngle, setStudioAngle] = useState('front');
  const characterTask = useRef(0);
  const costumeTask = useRef(0);
  const [panel, setPanel] = useState<'project' | 'settings' | 'usage' | null>(null);
  const [imageConfig, setImageConfig] = useState(loadImageConfig);
  const [generationJob, setGenerationJob] = useState<GenerationJob | null>(null);
  const generationController = useRef<AbortController | null>(null);
  const imageReady = !!(imageConfig.baseUrl && imageConfig.apiKey && imageConfig.model);
  const [selectedId, setSelectedId] = useState<string | null>(initialParams.get('item'));
  const [detailAngle, setDetailAngle] = useState(initialParams.get('detailAngle') || angle);
  const [toast, setToast] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);
  const downloadController = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
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
        setCatalog(resolveCustomAssets(data));
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
  }, [query, view, category, hair, collection, tag, style, country, kind, extended, sort]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => () => generationController.current?.abort(), []);
  useEffect(() => () => downloadController.current?.abort(), []);
  useEffect(
    () => () => {
      characterTask.current++;
      costumeTask.current++;
      costumeController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const preview = characterReference?.variant.image;
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [characterReference]);
  useEffect(() => {
    const preview = costumeReference?.variant.image;
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [costumeReference]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = '';
    const params: Record<string, string> = {
      lang,
      view,
      ...(query ? { q: query } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(extended ? { extended: '1' } : {}),
      ...(poseDepth ? { depth: '1' } : {}),
      ...(hair !== 'all' ? { hair } : {}),
      ...(collection !== 'all' ? { collection } : {}),
      ...(tag !== 'all' ? { tag } : {}),
      ...(style !== 'all' ? { style } : {}),
      ...(country !== 'all' ? { country } : {}),
      ...(kind !== 'all' ? { kind } : {}),
      ...(sort !== 'curated' ? { sort } : {}),
      ...(angle !== 'front' ? { angle } : {}),
      ...(selectedId ? { item: selectedId, detailAngle } : {}),
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    window.history.replaceState(null, '', url);
  }, [
    lang,
    view,
    query,
    category,
    hair,
    collection,
    tag,
    style,
    country,
    kind,
    sort,
    extended,
    poseDepth,
    angle,
    selectedId,
    detailAngle,
  ]);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);
  const items = useMemo(
    () => (catalog?.items || []).map((item) => (poseDepth ? withPoseDepth(item) : item)),
    [catalog, poseDepth],
  );
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
  const filters = { category, hair, collection, tag, style, country, kind, query };
  const visible = useMemo(
    () =>
      sortItems(
        filterReferences(byView, { category, hair, collection, tag, style, country, kind, query }),
        sort,
        lang,
      ),
    [byView, category, hair, collection, tag, style, country, kind, query, sort, lang],
  );
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (
      !sentinel ||
      view === 'studio' ||
      selectedId ||
      panel ||
      limit >= visible.length ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setLimit((current) => Math.min(current + 24, visible.length));
      },
      { rootMargin: '0px 0px 320px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visible, limit, view, selectedId, panel]);
  const resultKinds = new Set(visible.map((item) => item.kind));
  const characterCategory = byView.some(
    (item) => item.category.id === category && item.kind === 'character',
  );
  function changeCategory(value: string) {
    setCategory(value);
    if (
      view !== 'character' &&
      kind !== 'character' &&
      !byView.some((item) => item.category.id === value && item.kind === 'character')
    )
      setHair('all');
  }
  const activeFilters = [
    ...(query ? [{ key: 'q', label: `“${query}”`, clear: () => setQuery('') }] : []),
    ...(kind !== 'all'
      ? [
          {
            key: 'kind',
            label: t[kind as 'pose' | 'costume' | 'character'],
            clear: () => {
              setKind('all');
              setCategory('all');
              setHair('all');
            },
          },
        ]
      : []),
    ...(category !== 'all'
      ? [
          {
            key: 'category',
            label: byView.find((item) => item.category.id === category)?.category[lang] || category,
            clear: () => changeCategory('all'),
          },
        ]
      : []),
    ...(collection !== 'all'
      ? [
          {
            key: 'collection',
            label: collection === 'custom' ? t.customCollection : t.builtinCollection,
            clear: () => setCollection('all'),
          },
        ]
      : []),
    ...(tag !== 'all'
      ? [{ key: 'tag', label: referenceTagLabel(tag, lang), clear: () => setTag('all') }]
      : []),
    ...(style !== 'all'
      ? [{ key: 'style', label: referenceTagLabel(style, lang), clear: () => setStyle('all') }]
      : []),
    ...(country !== 'all'
      ? [
          {
            key: 'country',
            label: items.find((item) => item.country?.id === country)?.country?.[lang] || country,
            clear: () => setCountry('all'),
          },
        ]
      : []),
    ...(hair !== 'all'
      ? [
          {
            key: 'hair',
            label: t.hairLengths[hair as keyof typeof t.hairLengths] || hair,
            clear: () => setHair('all'),
          },
        ]
      : []),
  ];
  const hasFilters = activeFilters.length > 0;
  const selected = items.find((item) => item.id === selectedId);
  const selectedIndex = selected ? visible.findIndex((item) => item.id === selected.id) : -1;
  const variant = selected?.variants.find((v) => v.angle === detailAngle) || selected?.variants[0];
  const boardPose = items.find((item) => item.id === board.pose && item.kind === 'pose');
  const boardCostume = items.find((item) => item.id === board.costume && item.kind === 'costume');
  const boardCharacter = items.find(
    (item) => item.id === board.character && item.kind === 'character',
  );
  const activeCharacter: ImageReference | null =
    characterReference ||
    (boardCharacter
      ? {
          kind: 'character',
          title: boardCharacter.title,
          keywords: boardCharacter.keywords,
          variant: boardCharacter.variants[0],
        }
      : null);
  const boardCount =
    Number(!!boardPose) + Number(!!(costumeReference || boardCostume)) + Number(!!activeCharacter);
  const onBoard = (item: Reference) =>
    item.kind === 'character'
      ? !characterReference && board.character === item.id
      : item.kind === 'costume'
        ? !costumeReference && board.costume === item.id
        : board[item.kind] === item.id;
  const studioReferences: ImageReference[] = [];
  for (const item of [boardPose, costumeReference ? undefined : boardCostume]) {
    if (!item) continue;
    const variant =
      item.variants.find(
        (value) => value.angle === (item.kind === 'pose' ? studioAngle : 'front'),
      ) || item.variants[0];
    studioReferences.push({ kind: item.kind, title: item.title, keywords: item.keywords, variant });
  }
  if (costumeReference) studioReferences.push(costumeReference);
  if (activeCharacter) studioReferences.push(activeCharacter);
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
      key: 'character' as const,
      label: t.character,
      icon: UserRound,
      count: eligible.filter((item) => item.kind === 'character').length,
    },
    {
      key: 'saved' as const,
      label: t.saved,
      icon: Bookmark,
      count: eligible.filter((item) => saved.includes(item.id)).length,
    },
  ];
  const pageTitle =
    view === 'studio' ? studioCopy[lang].title : navItems.find((item) => item.key === view)!.label;
  const projectOpen = panel === 'project';
  const mobileLibraryActive = !projectOpen && view !== 'studio' && view !== 'saved';

  function changeView(next: View) {
    setSelectedId(null);
    setPanel(null);
    setView(next);
    setCategory('all');
    setHair('all');
    setCollection('all');
    setTag('all');
    setStyle('all');
    setCountry('all');
    setKind('all');
    setQuery('');
  }
  function resetFilters() {
    setCategory('all');
    setHair('all');
    setCollection('all');
    setTag('all');
    setStyle('all');
    setCountry('all');
    setKind('all');
    setQuery('');
  }
  function save(item: Reference) {
    const exists = saved.includes(item.id);
    setSaved((old) => (exists ? old.filter((id) => id !== item.id) : [...old, item.id]));
    notify(exists ? t.removedToast : t.savedToast);
  }
  function addToBoard(item: Reference) {
    if (item.kind === 'costume') {
      cancelCostumeExtraction();
      setCostumeLoading(false);
      setCostumeReference(null);
      setCharacterError('');
    }
    if (item.kind === 'character') {
      characterTask.current++;
      setCharacterLoading(false);
      setCharacterReference(null);
      setCharacterError('');
    }
    setBoard((old) => ({ ...old, [item.kind]: onBoard(item) ? undefined : item.id }));
    notify(t.boardToast);
  }
  function openDetail(item: Reference) {
    setDetailAngle(cardAngles[item.id] || angle);
    setSelectedId(item.id);
  }
  function setCardAngle(id: string, value: string) {
    setCardAngles((current) => (current[id] === value ? current : { ...current, [id]: value }));
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
  async function downloadOriginal(item: Reference, chosenVariant: Variant) {
    if (downloadController.current) return;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloadBusy(true);
    try {
      const response = await fetch(chosenVariant.original, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) throw Error('Download failed');
      const blob = await response.blob();
      const extensions: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
      };
      const extension = extensions[blob.type];
      if (!extension || !blob.size) throw Error('Invalid image');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename(`${item.id}-${chosenVariant.angle}`, extension);
      (document.querySelector('dialog[open]') || document.body).appendChild(link);
      link.click();
      link.remove();
      // Give the browser time to start reading the file before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      notify(t.downloadStarted);
    } catch {
      if (!controller.signal.aborted) notify(t.downloadFailed);
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
        setDownloadBusy(false);
      }
    }
  }
  function cancelGeneration() {
    generationController.current?.abort();
    generationController.current = null;
    setGenerationJob((old) => (old ? { ...old, status: 'cancelled' } : null));
  }
  async function runGeneration(
    references: ImageReference[],
    prompt: string,
    options: Pick<ImageConfig, 'size' | 'quality'>,
  ) {
    generationController.current?.abort();
    const controller = new AbortController();
    generationController.current = controller;
    const requestConfig = { ...imageConfig, ...options };
    const model = requestConfig.model.trim();
    const details = { model, references, prompt, ...options };
    setGenerationJob({ ...details, status: 'loading' });
    try {
      const result = await generateReferenceImage(
        requestConfig,
        references,
        prompt,
        controller.signal,
      );
      if (generationController.current === controller)
        setGenerationJob({ ...details, status: 'success', result });
    } catch (failure) {
      if (generationController.current !== controller || controller.signal.aborted) return;
      const t = generationCopy[lang];
      const code = failure instanceof ImageGenerationError ? failure.code : 'networkFailed';
      const summary = t[code as keyof typeof t] || t.networkFailed;
      const detail = failure instanceof ImageGenerationError ? failure.message : '';
      setGenerationJob({
        ...details,
        status: 'error',
        error: `${summary}${detail ? `\n${detail}` : ''}`,
      });
    }
  }
  function cancelCostumeExtraction() {
    costumeTask.current++;
    costumeController.current?.abort();
    costumeController.current = null;
    setCostumeLoading(false);
    setPendingCostume(null);
    setCostumeDialogOpen(false);
    setExtractedCostume(null);
    setExtractionError('');
  }
  async function selectReferenceFile(file: File, kind: 'character' | 'costume') {
    if (kind === 'character') return applyReferenceFile(file, kind);
    cancelCostumeExtraction();
    setCostumeDialogOpen(true);
    const task = costumeTask.current;
    try {
      await validateReferenceFile(file, 'costume');
      if (task !== costumeTask.current) return false;
      setPendingCostume(file);
      setCharacterError('');
      return true;
    } catch (error) {
      if (task === costumeTask.current) {
        const code = error instanceof ImageGenerationError ? error.code : 'costumeInvalid';
        setExtractionError(
          generationCopy[lang][code as keyof typeof generationCopy.zh] ||
            generationCopy[lang].costumeInvalid,
        );
      }
      return false;
    }
  }
  async function runCostumeExtraction() {
    if (!pendingCostume || costumeController.current) return;
    try {
      normalizeImageConfig(imageConfig);
    } catch {
      setExtractionError(generationCopy[lang].missingConfig);
      setPanel('settings');
      return;
    }
    const task = ++costumeTask.current;
    const controller = new AbortController();
    costumeController.current = controller;
    setCostumeLoading(true);
    setExtractedCostume(null);
    setExtractionError('');
    let preview = '';
    try {
      const file = await extractCostume(imageConfig, pendingCostume, controller.signal);
      preview = URL.createObjectURL(file);
      const image = new Image();
      image.src = preview;
      await image.decode();
      if (task === costumeTask.current) setExtractedCostume(file);
    } catch (error) {
      if (task === costumeTask.current) {
        const code = error instanceof ImageGenerationError ? error.code : 'networkFailed';
        const detail = error instanceof ImageGenerationError ? error.message : '';
        setExtractionError(
          `${studioCopy[lang].costumeExtractionFailed} ${generationCopy[lang][code as keyof typeof generationCopy.zh] || generationCopy[lang].networkFailed}${detail ? `\n${detail}` : ''}`,
        );
      }
    } finally {
      if (preview) URL.revokeObjectURL(preview);
      if (task === costumeTask.current) {
        costumeController.current = null;
        setCostumeLoading(false);
      }
    }
  }
  async function applyReferenceFile(file: File, kind: 'character' | 'costume') {
    const taskRef = kind === 'character' ? characterTask : costumeTask;
    const setLoading = kind === 'character' ? setCharacterLoading : setCostumeLoading;
    const setReference = kind === 'character' ? setCharacterReference : setCostumeReference;
    const task = ++taskRef.current;
    setLoading(true);
    setCharacterError('');
    let preview = '';
    try {
      await validateReferenceFile(file, kind);
      if (task !== taskRef.current) return false;
      preview = URL.createObjectURL(file);
      const image = new Image();
      image.src = preview;
      await image.decode();
      if (task !== taskRef.current) return false;
      setBoard((old) => ({ ...old, [kind]: undefined }));
      setReference({
        kind,
        file,
        title:
          kind === 'character'
            ? { zh: '人物参考', en: 'Character reference' }
            : { zh: '服饰参考', en: 'Outfit reference' },
        keywords: {
          zh:
            kind === 'character'
              ? '保留所附人物的五官、脸型、发型发色、肤色、体型比例与画风'
              : '采用所附服饰图片中的穿搭、配色、版型和材质，不采用服装模特的身份和姿势',
          en:
            kind === 'character'
              ? 'Preserve the attached character’s face, hairstyle, hair color, skin tone, proportions and visual style'
              : 'Use the outfit, colors, garment shape and materials from the uploaded costume; do not copy the clothing model’s identity or pose',
        },
        variant: {
          id: `${kind}-upload`,
          angle: 'front',
          label:
            kind === 'character' ? { zh: '人物', en: 'Character' } : { zh: '服饰', en: 'Costume' },
          thumbnail: preview,
          image: preview,
          original: preview,
        },
      });
      preview = ''; // Ownership passes to the reference cleanup effect.
      if (kind === 'costume') {
        cancelCostumeExtraction();
        notify(studioCopy[lang].costumeExtracted);
      }
      return true;
    } catch (error) {
      if (task === taskRef.current) {
        const code = error instanceof ImageGenerationError ? error.code : `${kind}Invalid`;
        if (kind === 'costume') setExtractionError(generationCopy[lang].costumeInvalid);
        else setCharacterError(code);
      }
      return false;
    } finally {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
      if (task === taskRef.current) {
        setLoading(false);
      }
    }
  }
  function openStudio() {
    setSelectedId(null);
    setPanel(null);
    setView('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function chooseStudioReference(item: Reference, angle = 'front') {
    if (item.kind === 'costume') {
      cancelCostumeExtraction();
      setCostumeLoading(false);
      setCostumeReference(null);
      setCharacterError('');
    }
    if (item.kind === 'character') {
      characterTask.current++;
      setCharacterLoading(false);
      setCharacterReference(null);
      setCharacterError('');
    }
    if (item.kind === 'pose')
      setStudioAngle(
        item.variants.some((variant) => variant.angle === angle) ? angle : item.variants[0].angle,
      );
    setBoard((old) => ({ ...old, [item.kind]: item.id }));
  }
  function removeStudioReference(kind: Reference['kind']) {
    if (kind === 'costume') {
      cancelCostumeExtraction();
      setCostumeLoading(false);
      setCostumeReference(null);
      setCharacterError('');
    }
    if (kind === 'character') {
      characterTask.current++;
      setCharacterLoading(false);
      setCharacterReference(null);
      setCharacterError('');
    }
    setBoard((old) => ({ ...old, [kind]: undefined }));
  }
  function beginGeneration(item?: Reference) {
    if (item) {
      chooseStudioReference(item);
      if (item.kind === 'pose') setStudioAngle(detailAngle);
    }
    openStudio();
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const isEditing =
        event.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
          event.target.isContentEditable);
      if (isEditing || view === 'studio') return;
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
  }, [selectedId, panel, step, view]);

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
          className={`nav-item board-nav ${view === 'studio' ? 'active' : ''}`}
          onClick={openStudio}
        >
          <LayoutPanelLeft size={19} />
          <span>{studioCopy[lang].title}</span>
          <small>{boardCount}/3</small>
        </button>
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
          <div className="social-links">
            <button className="social-link sidebar-about" onClick={() => setPanel('project')}>
              <Info size={16} />
              <span>{t.projectAbout}</span>
              <ChevronRight size={14} />
            </button>
            <a
              className="social-link"
              href="https://x.com/HongyeMain"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.xProfile}
              title={t.xProfile}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933ZM17.61 20.645h2.039L6.486 3.24H4.298L17.61 20.645Z" />
              </svg>
              @HongyeMain
              <ArrowUpRight size={14} />
            </a>
            <a
              className="social-link github-link"
              href="https://github.com/hongye007/open-pose-costume"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.githubRepo}
              title={t.githubRepo}
            >
              <Github size={16} />
              GitHub / open-pose-costume
              <ArrowUpRight size={14} />
            </a>
            <a
              className="social-link github-link"
              href="https://github.com/hongye007/open-pose-costume-skill"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.skillRepo}
              title={t.skillRepo}
            >
              <Sparkles size={16} />
              <span>Skill / open-pose-costume-skill</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
          <span className="local-note">
            <span />
            {t.local}
          </span>
        </div>
      </aside>

      <nav className="mobile-bottom-nav" aria-label={t.mobileNavigation}>
        <button
          className={mobileLibraryActive ? 'active' : ''}
          aria-current={mobileLibraryActive ? 'page' : undefined}
          onClick={() => {
            changeView('all');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Grid2X2 size={21} strokeWidth={mobileLibraryActive ? 2.4 : 1.9} />
          <span>{t.mobileLibrary}</span>
        </button>
        <button
          className={!projectOpen && view === 'studio' ? 'active' : ''}
          aria-current={!projectOpen && view === 'studio' ? 'page' : undefined}
          onClick={() => {
            openStudio();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Sparkles size={21} strokeWidth={!projectOpen && view === 'studio' ? 2.4 : 1.9} />
          <span>{studioCopy[lang].title}</span>
        </button>
        <button
          className={!projectOpen && view === 'saved' ? 'active' : ''}
          aria-current={!projectOpen && view === 'saved' ? 'page' : undefined}
          onClick={() => {
            changeView('saved');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span className="mobile-nav-icon">
            <Bookmark
              size={21}
              strokeWidth={!projectOpen && view === 'saved' ? 2.4 : 1.9}
              fill={!projectOpen && view === 'saved' ? 'currentColor' : 'none'}
            />
            {saved.length > 0 && <small>{saved.length > 99 ? '99+' : saved.length}</small>}
          </span>
          <span>{t.mobileSaved}</span>
        </button>
        <button
          className={projectOpen ? 'active' : ''}
          aria-current={projectOpen ? 'page' : undefined}
          onClick={() => setPanel('project')}
        >
          <Info size={21} strokeWidth={panel === 'project' ? 2.4 : 1.9} />
          <span>{t.projectAboutShort}</span>
        </button>
      </nav>

      <div className="workspace">
        <header className="topbar">
          <button
            className="topbar-brand"
            onClick={() => {
              changeView('all');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label={t.projectHome}
          >
            <img src={`${import.meta.env.BASE_URL}brand/logo-mark.png`} alt="" />
            <strong>open-pose-costume</strong>
          </button>
          <div className="header-actions">
            <button
              className={`mobile-extended-toggle ${extended ? 'active' : ''}`}
              aria-label={t.extended}
              aria-pressed={extended}
              title={t.extended}
              onClick={() => {
                setExtended((value) => !value);
                setCategory('all');
              }}
            >
              <Layers2 size={17} />
            </button>
            <ImageSettingsButton
              lang={lang}
              ready={imageReady}
              onClick={() => setPanel('settings')}
            />
            <button className="header-board" onClick={openStudio} aria-label={t.boardOpen}>
              <LayoutPanelLeft size={17} />
              {boardCount > 0 && <small>{boardCount}</small>}
            </button>
            <button
              className="header-source"
              onClick={() => setPanel('usage')}
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

        <main className={`library-main library-main-${view}`} hidden={view === 'studio'}>
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
            <HeroStudy lang={lang} />
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
              POSE + COSTUME + CHARACTER
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
            <div className="library-filter-panel">
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
                    <button
                      className="icon-button"
                      aria-label={t.clear}
                      onClick={() => setQuery('')}
                    >
                      <X size={16} />
                    </button>
                  ) : (
                    <kbd>/</kbd>
                  )}
                </div>
              </div>
              <ReferenceFilters
                items={byView}
                lang={lang}
                filters={filters}
                onCollection={setCollection}
                onTag={setTag}
                onStyle={setStyle}
                onCountry={setCountry}
              >
                {view === 'saved' && (
                  <div className="reference-filter-field">
                    <span>{t.kindFilter}</span>
                    <FilterSelect
                      label={t.kindFilter}
                      lang={lang}
                      value={kind}
                      onChange={(value) => {
                        setKind(value);
                        setCategory('all');
                        setHair('all');
                      }}
                      options={[
                        { value: 'all', label: t.allKinds },
                        ...(['pose', 'costume', 'character'] as const).map((value) => {
                          const count = filterReferences(byView, {
                            ...filters,
                            kind: value,
                            category: 'all',
                            hair: 'all',
                          }).length;
                          return {
                            value,
                            label: t[value],
                            count,
                            disabled: !count && kind !== value,
                          };
                        }),
                      ]}
                    />
                  </div>
                )}
                <CategoryFilter
                  items={byView}
                  filters={filters}
                  lang={lang}
                  onChange={changeCategory}
                />
                {(view === 'character' || kind === 'character' || characterCategory) && (
                  <div className="reference-filter-field">
                    <span>{t.hairLength}</span>
                    <FilterSelect
                      label={t.hairLength}
                      lang={lang}
                      value={hair}
                      onChange={setHair}
                      options={[
                        { value: 'all', label: t.allHair },
                        ...(['short', 'medium', 'medium-long', 'long'] as const).map((key) => {
                          const count = filterReferences(byView, { ...filters, hair: key }).length;
                          return {
                            value: key,
                            label: t.hairLengths[key],
                            count,
                            disabled: !count && hair !== key,
                          };
                        }),
                      ]}
                    />
                  </div>
                )}
              </ReferenceFilters>
              {hasFilters && (
                <div className="active-filter-row" role="group" aria-label={t.activeFilters}>
                  <span>{t.activeFilters}</span>
                  {activeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      aria-label={`${t.removeFilter}: ${filter.label}`}
                      onClick={filter.clear}
                    >
                      {filter.label}
                      <X size={12} />
                    </button>
                  ))}
                  <button className="filter-reset" onClick={resetFilters}>
                    {t.clear}
                  </button>
                </div>
              )}
            </div>
            <div className="result-toolbar library-result-toolbar">
              <span aria-live="polite">
                {visible.length.toLocaleString(lang)} {t.results}
              </span>
              <div className="library-display-options" role="group" aria-label={t.displayOptions}>
                {resultKinds.has('pose') && (
                  <label className="pose-depth-switch" title={t.depthHint}>
                    <span>{t.depth}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={poseDepth}
                      disabled={!poseDepth && !visible.some(hasPoseDepth)}
                      onChange={(event) => setPoseDepth(event.target.checked)}
                    />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                )}
                <label className="sort-control">
                  <span>{t.sort}</span>
                  <select
                    aria-label={t.sort}
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                  >
                    <option value="curated">
                      {resultKinds.size > 1 ? t.curated : t.defaultOrder}
                    </option>
                    <option value="name">{t.name}</option>
                    <option value="code">{t.code}</option>
                  </select>
                </label>
              </div>
            </div>

            {(poseDepth || !visible.some(hasPoseDepth)) &&
              visible.some((item) => item.kind === 'pose' && !hasPoseDepth(item)) && (
                <p className="depth-availability-note" role="status">
                  {visible.some(hasPoseDepth) ? t.depthPartial : t.noDepth}
                </p>
              )}
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
                  {view === 'saved' && !hasFilters ? <Bookmark size={30} /> : <Search size={30} />}
                </div>
                <h3>{view === 'saved' && !hasFilters ? t.noSaved : t.noResults}</h3>
                <p>{view === 'saved' && !hasFilters ? t.noSavedHint : t.noResultsHint}</p>
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
                    const cardAngle = cardAngles[item.id] || angle;
                    const preview =
                      item.variants.find((v) => v.angle === cardAngle) || item.variants[0];
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
                          {item.kind === 'pose' && (
                            <div className="pose-angle-strip" aria-label={t.angles}>
                              {item.variants.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  className={`pose-angle-thumb ${
                                    variant.id === preview.id ? 'active' : ''
                                  }`}
                                  aria-label={variant.label[lang]}
                                  aria-pressed={variant.id === preview.id}
                                  onMouseEnter={() => setCardAngle(item.id, variant.angle)}
                                  onFocus={() => setCardAngle(item.id, variant.angle)}
                                  onClick={() => setCardAngle(item.id, variant.angle)}
                                >
                                  <span className="pose-angle-thumb-image">
                                    <RemoteImage
                                      src={variant.thumbnail}
                                      alt=""
                                      lang={lang}
                                      eager={index < 4}
                                    />
                                  </span>
                                  <span className="pose-angle-thumb-label">
                                    {variant.label[lang]}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          <span className="card-type">
                            {item.kind === 'pose' ? (
                              <PersonStanding size={13} />
                            ) : item.kind === 'costume' ? (
                              <Shirt size={13} />
                            ) : (
                              <UserRound size={13} />
                            )}{' '}
                            {item.kind === 'pose'
                              ? 'POSE'
                              : item.kind === 'costume'
                                ? 'COSTUME'
                                : 'CHARACTER'}
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
                            <code>{item.code}</code>
                          </div>
                          <button className="card-title" onClick={() => openDetail(item)}>
                            {item.title[lang]}
                          </button>
                          <ReferenceBadges item={item} lang={lang} />
                          {poseDepth && item.kind === 'pose' && !hasPoseDepth(item) && (
                            <small className="depth-availability-note">{t.noDepth}</small>
                          )}
                          <div className="card-bottom">
                            <span>
                              {item.kind === 'character'
                                ? item.series[lang]
                                : item.kind === 'pose'
                                  ? preview.label[lang]
                                  : item.keywords[lang].split(' ').slice(0, 3).join(' · ')}
                            </span>
                            <button
                              className={onBoard(item) ? 'add-pair selected' : 'add-pair'}
                              aria-label={onBoard(item) ? t.removeBoard : t.addBoard}
                              onClick={() => addToBoard(item)}
                            >
                              {onBoard(item) ? <Check size={15} /> : <Plus size={15} />}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div ref={loadMoreRef} className="load-more">
                  <p>
                    {t.shown} {Math.min(limit, visible.length)} {t.of}{' '}
                    {visible.length.toLocaleString(lang)}
                  </p>
                  {limit < visible.length ? (
                    <button
                      className="secondary-button"
                      onClick={() => setLimit((v) => Math.min(v + 24, visible.length))}
                    >
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
            <button onClick={() => setPanel('usage')}>
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
        <main className="studio-main" hidden={view !== 'studio'}>
          <GenerationStudio
            lang={lang}
            references={studioReferences}
            items={eligible}
            poseItem={boardPose}
            job={generationJob}
            config={imageConfig}
            characterLoading={characterLoading || costumeLoading}
            characterError={characterError}
            poseDepth={poseDepth}
            onDepth={setPoseDepth}
            onChoose={chooseStudioReference}
            onRemove={removeStudioReference}
            onAngle={setStudioAngle}
            onUpload={(file, kind) => void selectReferenceFile(file, kind)}
            onOpenCostumeUpload={() => {
              cancelCostumeExtraction();
              setCostumeDialogOpen(true);
            }}
            onSettings={() => setPanel('settings')}
            onRun={(references, prompt, options) => void runGeneration(references, prompt, options)}
            onCancel={cancelGeneration}
            onReuse={async (file) => {
              if (!(await selectReferenceFile(file, 'character'))) throw Error('characterInvalid');
            }}
            notify={notify}
            onRestore={(record, references, source) => {
              if (generationJob?.status === 'loading') return;
              characterTask.current++;
              cancelCostumeExtraction();
              setCostumeLoading(false);
              setCharacterLoading(false);
              setCharacterError('');
              const costume = references.find((ref) => ref.kind === 'costume');
              setCostumeReference(costume && 'file' in costume ? costume : null);
              const character = references.find((ref) => ref.kind === 'character');
              setCharacterReference(character && 'file' in character ? character : null);
              const nextBoard: Board = {};
              for (const reference of references) {
                if ('file' in reference) continue;
                const item = items.find(
                  (item) =>
                    item.kind === reference.kind &&
                    item.variants.some((variant) => variant.id === reference.variant.id),
                );
                if (item) nextBoard[reference.kind] = item.id;
              }
              setBoard(nextBoard);
              const pose = references.find((ref) => ref.kind === 'pose');
              setStudioAngle(pose?.variant.angle || 'front');
              setPoseDepth(!!pose && isDepthVariant(pose.variant));
              setGenerationJob({
                model: record.model,
                prompt: record.prompt,
                references,
                result: source,
                status: 'success',
                size: record.size,
                quality: record.quality,
                restored: true,
              });
            }}
          />
        </main>
      </div>

      {selected && variant && (
        <Modal onClose={closeDetail} label={selected.title[lang]} className="detail-modal">
          <div className="detail-stage">
            <div className="detail-stage-top">
              <span>
                {selected.kind === 'pose'
                  ? 'POSE STUDY'
                  : selected.kind === 'costume'
                    ? 'COSTUME STUDY'
                    : 'CHARACTER STUDY'}{' '}
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
            <ReferenceBadges item={selected} lang={lang} />
            {selected.collection === 'custom' && (
              <p className="custom-usage-notice">{t.customUsageNotice}</p>
            )}
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
                <button
                  className="text-action reference-generate"
                  disabled={!imageReady || characterLoading || costumeLoading}
                  onClick={() => beginGeneration(selected)}
                >
                  <Sparkles size={14} />
                  {generationCopy[lang].generate}
                </button>
                {!imageReady && (
                  <span className="reference-generate-hint">
                    {generationCopy[lang].configureFirst}
                  </span>
                )}
              </div>
            </div>
            <div className="detail-actions">
              <button className="primary-button" onClick={() => addToBoard(selected)}>
                {onBoard(selected) ? <Check size={17} /> : <Plus size={17} />}{' '}
                {onBoard(selected) ? t.removeBoard : t.addBoard}
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
                  onClick={() => downloadOriginal(selected, variant)}
                  disabled={downloadBusy}
                  aria-busy={downloadBusy}
                  aria-label={downloadBusy ? t.downloading : t.downloadOriginal}
                  title={downloadBusy ? t.downloading : t.downloadOriginal}
                >
                  {downloadBusy ? (
                    <LoaderCircle size={16} className="spinner" />
                  ) : (
                    <Download size={16} />
                  )}
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

      {costumeDialogOpen && (
        <CostumeExtractionDialog
          lang={lang}
          file={pendingCostume}
          result={extractedCostume}
          loading={costumeLoading}
          error={extractionError}
          onUpload={(file) => void selectReferenceFile(file, 'costume')}
          onExtract={() => void runCostumeExtraction()}
          onUseOriginal={() => {
            if (pendingCostume && !costumeLoading)
              void applyReferenceFile(pendingCostume, 'costume');
          }}
          onConfirm={() => {
            if (extractedCostume && !costumeLoading)
              void applyReferenceFile(extractedCostume, 'costume');
          }}
          onClose={cancelCostumeExtraction}
        />
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
      {panel === 'usage' && (
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
      {panel === 'project' && (
        <Modal onClose={() => setPanel(null)} label={t.projectAbout} className="project-modal">
          <div className="panel-heading project-heading">
            <div>
              <span className="section-kicker">OPEN SOURCE REFERENCE STUDIO</span>
              <h2>{t.projectAboutTitle}</h2>
            </div>
            <button className="icon-button" aria-label={t.close} onClick={() => setPanel(null)}>
              <X size={22} />
            </button>
          </div>
          <p className="project-intro">{t.projectAboutIntro}</p>
          <div className="project-stats" aria-label={t.projectScale}>
            <div>
              <strong>{catalog?.stats.references.toLocaleString(lang) || '—'}</strong>
              <span>{t.projectReferences}</span>
            </div>
            <div>
              <strong>{catalog?.stats.images.toLocaleString(lang) || '—'}</strong>
              <span>{t.projectImages}</span>
            </div>
            <div>
              <strong>{catalog?.stats.poseGroups.toLocaleString(lang) || '—'}</strong>
              <span>{t.projectPoses}</span>
            </div>
            <div>
              <strong>{catalog?.stats.costumes.toLocaleString(lang) || '—'}</strong>
              <span>{t.projectCostumes}</span>
            </div>
            <div>
              <strong>{catalog?.stats.characters.toLocaleString(lang) || '—'}</strong>
              <span>{t.projectCharacters}</span>
            </div>
          </div>
          <section className="project-section">
            <h3>{t.projectRepositories}</h3>
            <a
              className="project-link"
              href="https://github.com/hongye007/open-pose-costume"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={18} />
              <span>
                <strong>open-pose-costume</strong>
                <small>github.com/hongye007/open-pose-costume</small>
              </span>
              <ExternalLink size={15} />
            </a>
            <a
              className="project-link"
              href="https://github.com/hongye007/open-pose-costume-skill"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Sparkles size={18} />
              <span>
                <strong>open-pose-costume-skill</strong>
                <small>github.com/hongye007/open-pose-costume-skill</small>
              </span>
              <ExternalLink size={15} />
            </a>
          </section>
          <section className="project-section project-author">
            <h3>{t.projectAuthor}</h3>
            <div>
              <span className="author-mark">H</span>
              <span>
                <strong>hongye007</strong>
                <small>@HongyeMain</small>
              </span>
              <a href="https://github.com/hongye007" target="_blank" rel="noopener noreferrer">
                GitHub <ExternalLink size={13} />
              </a>
              <a href="https://x.com/HongyeMain" target="_blank" rel="noopener noreferrer">
                X <ExternalLink size={13} />
              </a>
            </div>
          </section>
        </Modal>
      )}
      {showDomainNotice && (
        <Modal onClose={dismissDomainNotice} label={lang === 'zh' ? '新域名已启用' : 'Visit our new domain'} className="about-modal">
          <div className="panel-heading">
            <h2>{lang === 'zh' ? '新域名已启用' : 'Visit our new domain'}</h2>
            <button className="icon-button" aria-label={t.close} onClick={dismissDomainNotice}><X size={22} /></button>
          </div>
          <p>{lang === 'zh'
            ? '为了提供更稳定的网络访问服务，我们已启用新域名 omilic.com，建议前往新站继续使用。'
            : 'For more reliable access, we have launched our new domain, omilic.com. We recommend continuing on the new site.'}</p>
          <p>{lang === 'zh' ? '收藏和 API 配置保存在当前浏览器的本站数据中，切换域名后需要重新设置。' : 'Favorites and API settings are stored for this domain and will need to be set up again on the new site.'}</p>
          <label className="domain-notice-opt-out">
            <input type="checkbox" checked={domainNoticeOptOut} onChange={(event) => setDomainNoticeOptOut(event.target.checked)} />
            <span>{lang === 'zh' ? '不再提醒' : 'Do not remind me again'}</span>
          </label>
          <div className="domain-notice-actions">
            <a className="primary-button" href={newDomainUrl} onClick={dismissDomainNotice}>{lang === 'zh' ? '前往新站' : 'Visit new site'}<ExternalLink size={16} /></a>
            <button className="text-action" onClick={dismissDomainNotice}>{lang === 'zh' ? '暂时留在这里' : 'Stay here for now'}</button>
          </div>
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
