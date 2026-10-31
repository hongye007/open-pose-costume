import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  Download,
  History,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  PersonStanding,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Shuffle,
  Shirt,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { ComparisonWipe, ImageDownloadButton, ImageLightbox } from './generation-ui';
import { generationCopy } from './generation-copy';
import { studioCopy } from './studio-copy';
import { imageSizes, referencePrompt } from './generation';
import type { GenerationJob, ImageConfig, ImageReference } from './generation';
import {
  deleteGenerationRecord,
  listGenerationHistory,
  readResultBlob,
  saveGenerationRecord,
} from './generation-history';
import type { GenerationRecord } from './generation-history';
import { matchesQuery } from './library';
import { Modal, RemoteImage } from './ui';
import type { Kind, Lang, Reference } from './types';

const kinds: Kind[] = ['pose', 'costume', 'character'];
const referenceIcons = { pose: PersonStanding, costume: Shirt, character: UserRound };
const styleKeys = ['follow', 'photo', 'studio', 'anime'] as const;
type Style = (typeof styleKeys)[number];
const referenceFingerprint = (references: ImageReference[]) =>
  references.map((ref) => `${ref.kind}:${ref.variant.original}`).join('|');

function ReferencePicker({
  kind,
  items,
  lang,
  onChoose,
  onClose,
}: {
  kind: Kind;
  items: Reference[];
  lang: Lang;
  onChoose: (item: Reference) => void;
  onClose: () => void;
}) {
  const t = studioCopy[lang];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [limit, setLimit] = useState(24);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const available = useMemo(() => items.filter((item) => item.kind === kind), [items, kind]);
  const categories = [
    ...new Map(available.map((item) => [item.category.id, item.category[lang]])).entries(),
  ];
  const filtered = available.filter(
    (item) => (category === 'all' || item.category.id === category) && matchesQuery(item, query),
  );
  const hasMore = filtered.length > limit;
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setLimit((current) => Math.min(current + 24, filtered.length));
      },
      { root: sentinel.closest('dialog'), rootMargin: '0px 0px 160px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, limit, filtered.length, query, category]);
  return (
    <Modal
      onClose={onClose}
      label={`${t.choose} ${generationCopy[lang][kind]}`}
      className="studio-picker-modal"
    >
      <div className="panel-heading">
        <h2>
          {t.choose} {generationCopy[lang][kind]}
        </h2>
        <button className="icon-button" aria-label={generationCopy[lang].close} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="studio-picker-filters">
        <label className="studio-picker-search">
          <Search size={16} />
          <input
            autoFocus
            value={query}
            placeholder={t.search}
            aria-label={t.search}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(24);
            }}
          />
        </label>
        <select
          value={category}
          aria-label={t.allCategories}
          onChange={(e) => {
            setCategory(e.target.value);
            setLimit(24);
          }}
        >
          <option value="all">{t.allCategories}</option>
          {categories.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="studio-picker-grid">
        {filtered.slice(0, limit).map((item) => (
          <button key={item.id} onClick={() => onChoose(item)}>
            <RemoteImage src={item.variants[0].thumbnail} alt={item.title[lang]} lang={lang} />
            <span>{item.title[lang]}</span>
          </button>
        ))}
      </div>
      {!filtered.length && <p className="studio-picker-empty">{t.noMatches}</p>}
      {hasMore && (
        <div ref={loadMoreRef} className="studio-picker-more">
          <button
            className="secondary-button"
            onClick={() => setLimit((current) => Math.min(current + 24, filtered.length))}
          >
            {t.more}
          </button>
        </div>
      )}
    </Modal>
  );
}

function HistoryThumbnail({
  record,
  onRestore,
  onDelete,
  lang,
}: {
  record: GenerationRecord;
  onRestore: () => void;
  onDelete: () => void;
  lang: Lang;
}) {
  const [source, setSource] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const downloadingRef = useRef(false);
  const t = studioCopy[lang];
  useEffect(() => {
    const url = URL.createObjectURL(record.image);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [record.image]);
  return (
    <article className="studio-history-item">
      <button onClick={onRestore} aria-label={studioCopy[lang].restore}>
        {source && <img src={source} alt={generationCopy[lang].generated} />}
        <span>
          {new Date(record.createdAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          <small>
            {record.model} · {record.size}
          </small>
          <small>
            {studioCopy[lang].restore} <ArrowRight size={12} />
          </small>
        </span>
      </button>
      <div className="studio-history-actions">
        <button
          className="studio-history-download secondary-button"
          title={t.downloadReferencesHint}
          disabled={downloading || !record.references.length}
          aria-busy={downloading}
          onClick={async () => {
            if (downloadingRef.current) return;
            downloadingRef.current = true;
            setDownloading(true);
            setDownloadFailed(false);
            try {
              const { downloadReferences } = await import('./reference-download');
              await downloadReferences(record.references, record.createdAt);
            } catch {
              setDownloadFailed(true);
            } finally {
              downloadingRef.current = false;
              setDownloading(false);
            }
          }}
        >
          {downloading ? <LoaderCircle size={14} className="spinner" /> : <Download size={14} />}
          {downloading
            ? t.downloadingReferences
            : downloadFailed
              ? t.retryDownload
              : t.downloadReferences}
        </button>
        <button className="icon-button" aria-label={t.delete} onClick={onDelete}>
          <Trash2 size={15} />
        </button>
        {downloadFailed && (
          <p className="studio-inline-error" role="alert">
            {t.referenceDownloadFailed}
          </p>
        )}
      </div>
    </article>
  );
}

export function GenerationStudio({
  lang,
  references,
  items,
  poseItem,
  job,
  config,
  characterLoading,
  characterError,
  poseDepth,
  onDepth,
  onChoose,
  onRemove,
  onAngle,
  onUpload,
  onOpenCostumeUpload,
  onSettings,
  onRun,
  onCancel,
  onReuse,
  onRestore,
  notify,
}: {
  lang: Lang;
  references: ImageReference[];
  items: Reference[];
  poseItem?: Reference;
  job: GenerationJob | null;
  config: ImageConfig;
  characterLoading: boolean;
  characterError: string;
  poseDepth: boolean;
  onDepth: (value: boolean) => void;
  onChoose: (item: Reference) => void;
  onRemove: (kind: Kind) => void;
  onAngle: (angle: string) => void;
  onUpload: (file: File, kind: 'character' | 'costume') => void;
  onOpenCostumeUpload: () => void;
  onSettings: () => void;
  onRun: (
    references: ImageReference[],
    prompt: string,
    options: Pick<ImageConfig, 'size' | 'quality'>,
  ) => void;
  onCancel: () => void;
  onReuse: (file: File) => Promise<void>;
  onRestore: (record: GenerationRecord, references: ImageReference[], source: string) => void;
  notify: (message: string) => void;
}) {
  const t = studioCopy[lang],
    g = generationCopy[lang];
  const [picker, setPicker] = useState<Kind | null>(null);
  const [style, setStyle] = useState<Style>('follow');
  const [extra, setExtra] = useState('');
  const [customPrompt, setCustomPrompt] = useState<{ text: string; references: string } | null>(
    null,
  );
  const [size, setSize] = useState(config.size);
  const [quality, setQuality] = useState(config.quality);
  const [mode, setMode] = useState<'result' | 'split' | 'overlay'>('result');
  const [compareKind, setCompareKind] = useState<Kind>('pose');
  const [lightbox, setLightbox] = useState<{
    source: string;
    downloadSource: string;
    filename: string;
    alt: string;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reusing, setReusing] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fileInputs = useRef<Partial<Record<'character' | 'costume', HTMLInputElement | null>>>({});
  const savedResult = useRef<GenerationJob | null>(null);
  const restoredUrls = useRef<string[]>([]);
  const loading = job?.status === 'loading';
  const ready = !!(config.baseUrl && config.apiKey && config.model);
  const missing = kinds.filter(
    (kind) => kind !== 'character' && !references.some((ref) => ref.kind === kind),
  );
  const autoPrompt = references.length
    ? `${referencePrompt(references, lang)}${style !== 'follow' ? `\n${t.style}: ${t[style]}.` : ''}${extra.trim() ? `\n${extra.trim()}` : ''}`
    : '';
  const fingerprint = referenceFingerprint(references);
  const customActive = customPrompt?.references === fingerprint;
  const prompt = customActive ? customPrompt.text : autoPrompt;
  const [comparisonReferences, setComparisonReferences] = useState<ImageReference[]>([]);
  useEffect(() => {
    const owned: string[] = [];
    setComparisonReferences(
      (job?.references || []).map((reference) => {
        if (!('file' in reference)) return reference;
        const source = URL.createObjectURL(reference.file);
        owned.push(source);
        return {
          ...reference,
          variant: { ...reference.variant, thumbnail: source, image: source, original: source },
        };
      }),
    );
    return () => owned.forEach(URL.revokeObjectURL);
  }, [job?.references]);
  const compared =
    comparisonReferences.find((ref) => ref.kind === compareKind) || comparisonReferences[0];
  useEffect(() => {
    setSize(config.size);
    setQuality(config.quality);
  }, [config.size, config.quality]);
  useEffect(() => {
    void listGenerationHistory()
      .then(setHistory)
      .catch(() => setHistoryError(true));
    return () => restoredUrls.current.forEach(URL.revokeObjectURL);
  }, []);
  useEffect(() => {
    setImageFailed(false);
  }, [job?.result]);
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [job, loading]);
  useEffect(() => {
    if (!job?.result || job.status !== 'success' || savedResult.current === job || job.restored)
      return;
    savedResult.current = job;
    const completed = job;
    void (async () => {
      try {
        const image = await readResultBlob(completed.result!);
        await saveGenerationRecord({
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          model: completed.model,
          size: completed.size || config.size,
          quality: completed.quality || config.quality,
          prompt: completed.prompt,
          references: completed.references,
          image,
        });
        setHistory(await listGenerationHistory());
        setHistoryError(false);
      } catch {
        setHistoryError(true);
        notify(t.historySaveFailed);
      }
    })();
  }, [job, config.size, config.quality, notify, t.historySaveFailed]);

  function openImage(source: string, alt: string, filename: string) {
    setLightbox({ source, downloadSource: source, filename, alt });
  }
  async function restore(record: GenerationRecord) {
    const restoredRefs = record.references.map((ref) => {
      if (!('file' in ref)) return ref;
      const source = URL.createObjectURL(ref.file);
      restoredUrls.current.push(source);
      return {
        ...ref,
        variant: { ...ref.variant, image: source, original: source, thumbnail: source },
      };
    });
    const source = URL.createObjectURL(record.image);
    restoredUrls.current.push(source);
    setCustomPrompt({ text: record.prompt, references: referenceFingerprint(restoredRefs) });
    setStyle('follow');
    setExtra('');
    setSize(record.size);
    setQuality(record.quality);
    onRestore(record, restoredRefs, source);
    setHistoryOpen(false);
  }
  async function reuse() {
    if (!job?.result || reusing) return;
    setReusing(true);
    try {
      const blob = await readResultBlob(job.result);
      const extension =
        blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      await onReuse(new File([blob], `generated-character.${extension}`, { type: blob.type }));
      setCustomPrompt(null);
      notify(t.reused);
    } catch {
      notify(t.reuseFailed);
    } finally {
      setReusing(false);
    }
  }
  function run() {
    if (missing.length || !ready || !prompt.trim() || loading || characterLoading) return;
    onRun(references, prompt, { size, quality });
  }
  return (
    <section className="image-studio" aria-label={t.title}>
      <div className="studio-heading">
        <div>
          <span className="section-kicker">REFERENCE STUDIO</span>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <div className="studio-heading-actions">
          <button
            className="secondary-button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen(!historyOpen)}
          >
            <History size={16} />
            {t.history}
            {history.length > 0 && <small>{history.length}</small>}
          </button>
          <button
            className={`secondary-button studio-config ${ready ? 'configured' : ''}`}
            onClick={onSettings}
          >
            <Settings2 size={16} />
            {ready ? t.configured : t.noConfig}
          </button>
        </div>
      </div>
      <div className="studio-layout">
        <section className="studio-controls" aria-label={t.references}>
          <div className="studio-section-heading">
            <h2>{t.references}</h2>
            <button
              type="button"
              className="studio-randomize"
              disabled={loading || characterLoading}
              onClick={() => {
                for (const kind of kinds) {
                  const candidates = items.filter((item) => item.kind === kind);
                  const current = references.find((reference) => reference.kind === kind);
                  const alternatives = candidates.filter(
                    (item) =>
                      !item.variants.some(
                        (variant) => variant.original === current?.variant.original,
                      ),
                  );
                  const pool = alternatives.length ? alternatives : candidates;
                  if (pool.length) onChoose(pool[Math.floor(Math.random() * pool.length)]);
                }
                setCustomPrompt(null);
              }}
            >
              <Shuffle size={13} />
              {t.randomize}
            </button>
          </div>
          <div className="studio-reference-slots">
            {kinds.map((kind) => {
              const ref = references.find((value) => value.kind === kind),
                Icon = referenceIcons[kind];
              return (
                <div
                  className="studio-reference-slot"
                  key={kind}
                  onDragOver={(event) => {
                    if (kind !== 'pose' && !loading) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (kind !== 'pose' && !loading && event.dataTransfer.files[0]) {
                      onUpload(event.dataTransfer.files[0], kind);
                      setCustomPrompt(null);
                    }
                  }}
                  onPaste={(event) => {
                    const file = event.clipboardData.files[0];
                    if (kind !== 'pose' && !loading && file) {
                      event.preventDefault();
                      onUpload(file, kind);
                      setCustomPrompt(null);
                    }
                  }}
                >
                  <button
                    className={`studio-slot-image ${ref ? 'filled' : ''}`}
                    aria-label={`${t.choose} ${g[kind]}`}
                    disabled={loading}
                    onClick={() => setPicker(kind)}
                  >
                    {ref ? (
                      <RemoteImage
                        src={ref.variant.thumbnail}
                        alt={ref.title[lang]}
                        lang={lang}
                        eager
                      />
                    ) : (
                      <span>
                        <Icon size={27} strokeWidth={1.3} />
                        <Plus size={13} />
                      </span>
                    )}
                    <span className="studio-slot-replace">
                      <Plus size={12} />
                    </span>
                  </button>
                  <div className="studio-slot-label">
                    <strong>{g[kind]}</strong>
                    <small>{kind === 'character' ? t.optional : t.required}</small>
                  </div>
                  <div className="studio-slot-caption">
                    <span>{ref ? ref.title[lang] : t.choose}</span>
                    {ref && (
                      <button
                        className="icon-button"
                        aria-label={`${t.remove}: ${g[kind]}`}
                        disabled={loading}
                        onClick={() => {
                          onRemove(kind);
                          setCustomPrompt(null);
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {kind !== 'pose' && (
                    <>
                      {kind === 'character' && (
                        <input
                          ref={(input) => {
                            fileInputs.current[kind] = input;
                          }}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          disabled={loading || characterLoading}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (file) {
                              onUpload(file, kind);
                              setCustomPrompt(null);
                            }
                          }}
                        />
                      )}
                      <button
                        className="studio-upload-button"
                        disabled={loading || characterLoading}
                        onClick={() => {
                          if (kind === 'costume') onOpenCostumeUpload();
                          else fileInputs.current[kind]?.click();
                        }}
                      >
                        <ImagePlus size={12} />
                        {kind === 'costume' ? t.uploadCostume : t.upload}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="studio-upload-note">{t.uploadHint}</p>
          <p className="studio-upload-note">{t.costumeExtractionHint}</p>
          {characterError && (
            <p className="studio-inline-error" role="alert">
              {g[characterError as keyof typeof g] || characterError}
            </p>
          )}
          <div className="studio-pose-options">
            <label className="studio-depth">
              <input
                type="checkbox"
                checked={poseDepth}
                disabled={loading}
                onChange={(e) => {
                  onDepth(e.target.checked);
                  setCustomPrompt(null);
                }}
              />
              <span>{t.depth}</span>
            </label>
            {poseItem && poseItem.variants.length > 1 && (
              <label className="studio-angle">
                {t.angle}
                <select
                  aria-label={t.angle}
                  disabled={loading}
                  value={references.find((ref) => ref.kind === 'pose')?.variant.angle || 'front'}
                  onChange={(e) => {
                    onAngle(e.target.value);
                    setCustomPrompt(null);
                  }}
                >
                  {poseItem.variants.map((variant) => (
                    <option key={variant.id} value={variant.angle}>
                      {variant.label[lang]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="studio-controls-divider" />
          <div className="studio-section-heading">
            <h2>{t.style}</h2>
            <span>{t.optional}</span>
          </div>
          <div className="studio-styles">
            {styleKeys.map((key) => (
              <button
                key={key}
                aria-pressed={style === key}
                disabled={loading}
                onClick={() => {
                  setStyle(key);
                  setCustomPrompt(null);
                }}
              >
                {t[key]}
              </button>
            ))}
          </div>
          <label className="studio-field-label" htmlFor="studio-size">
            {t.size}
          </label>
          <select
            id="studio-size"
            className="studio-select"
            disabled={loading}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          >
            {imageSizes.map((value) => (
              <option key={value} value={value}>
                {value === 'auto' ? g.auto : value.replace('x', ' × ')}
              </option>
            ))}
          </select>
          <label className="studio-field-label" htmlFor="studio-extra">
            {t.extra}
            <small>{t.optional}</small>
          </label>
          <textarea
            id="studio-extra"
            value={extra}
            disabled={loading}
            onChange={(e) => {
              setExtra(e.target.value);
              setCustomPrompt(null);
            }}
            placeholder={t.extraHint}
            rows={3}
          />
          <details className="studio-advanced">
            <summary>
              {t.advanced}
              {customActive && <small>{t.customPrompt}</small>}
            </summary>
            <label className="studio-field-label" htmlFor="studio-quality">
              {g.quality}
            </label>
            <select
              id="studio-quality"
              className="studio-select"
              value={quality}
              disabled={loading}
              onChange={(e) => setQuality(e.target.value as ImageConfig['quality'])}
            >
              {(['auto', 'low', 'medium', 'high'] as const).map((key) => (
                <option key={key} value={key}>
                  {g[key]}
                </option>
              ))}
            </select>
            <label className="studio-field-label" htmlFor="studio-prompt">
              {g.prompt}
            </label>
            <textarea
              id="studio-prompt"
              value={prompt}
              rows={7}
              disabled={loading}
              onChange={(e) => setCustomPrompt({ text: e.target.value, references: fingerprint })}
            />
            <button
              className="text-action"
              disabled={loading}
              onClick={() => setCustomPrompt(null)}
            >
              <RotateCcw size={13} />
              {t.resetPrompt}
            </button>
          </details>
          <div className="studio-generate-area">
            <div className="studio-readiness" role="status">
              <span>
                {missing.length
                  ? `${t.missing}${missing.map((kind) => g[kind]).join('、')}`
                  : `${references.length} ${t.ready}`}
              </span>
              <code>{config.model}</code>
            </div>
            {!ready && (
              <button className="studio-api-hint" onClick={onSettings}>
                <Settings2 size={13} />
                {t.config}
                <ArrowRight size={13} />
              </button>
            )}
            <button
              className="primary-button studio-generate-button"
              disabled={
                loading || !ready || missing.length > 0 || !prompt.trim() || characterLoading
              }
              onClick={run}
            >
              {loading ? <LoaderCircle size={17} className="spinner" /> : <Sparkles size={17} />}
              {loading ? g.generating : t.generate}
              <ArrowRight size={15} />
            </button>
            <p className="studio-settings-note">{ready ? t.keepWorking : t.settingsHint}</p>
          </div>
        </section>
        <section className="studio-result" aria-label={g.generated}>
          <div className="studio-result-toolbar">
            <div className="generation-preview-switch" role="group" aria-label={g.previewMode}>
              {(['result', 'split', 'overlay'] as const).map((key) => (
                <button
                  key={key}
                  disabled={!job?.result || loading}
                  aria-pressed={mode === key}
                  onClick={() => setMode(key)}
                >
                  {key === 'result' ? t.resultOnly : key === 'split' ? g.sideBySide : g.overlay}
                </button>
              ))}
            </div>
            {job?.result && (
              <button
                className="icon-button"
                aria-label={g.openImage}
                onClick={() => openImage(job.result!, g.generated, 'generated-character')}
              >
                <Maximize2 size={17} />
              </button>
            )}
          </div>
          {job?.result && mode !== 'result' && (
            <label className="studio-compare-label">
              {t.compare}
              <select
                value={compared?.kind}
                onChange={(e) => setCompareKind(e.target.value as Kind)}
              >
                {job.references.map((ref) => (
                  <option key={ref.kind} value={ref.kind}>
                    {g[ref.kind]}
                  </option>
                ))}
              </select>
              {mode === 'overlay' && <span>{g.overlayHint}</span>}
            </label>
          )}
          <div className={`studio-canvas ${mode === 'split' && job?.result ? 'studio-split' : ''}`}>
            {loading ? (
              <div className="studio-placeholder" role="status">
                <LoaderCircle size={31} className="spinner" />
                <h2>{g.waiting}</h2>
                <p>{t.loadingHint}</p>
                <span className="studio-elapsed">
                  <Clock3 size={13} />
                  {t.elapsed} {elapsed} {t.seconds}
                </span>
                <button className="secondary-button" onClick={onCancel}>
                  {t.cancel}
                </button>
              </div>
            ) : job?.status === 'error' || job?.status === 'cancelled' ? (
              <div className="studio-placeholder studio-failed" role="alert">
                <RotateCcw size={28} />
                <h2>{job.status === 'cancelled' ? g.cancelled : g.failed}</h2>
                <p>{job.status === 'cancelled' ? t.keepWorking : job.error}</p>
                <button
                  className="primary-button"
                  disabled={!ready}
                  onClick={() =>
                    onRun(job.references, job.prompt, {
                      size: job.size || size,
                      quality: job.quality || quality,
                    })
                  }
                >
                  <RotateCcw size={15} />
                  {g.retry}
                </button>
              </div>
            ) : job?.result ? (
              imageFailed ? (
                <div className="studio-placeholder">
                  <p>{g.imageFailed}</p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setImageFailed(false);
                      setAttempt(attempt + 1);
                    }}
                  >
                    {g.retryImage}
                  </button>
                </div>
              ) : mode === 'overlay' && compared ? (
                <ComparisonWipe
                  key={`${job.result}-${compared.variant.id}-${attempt}`}
                  reference={compared}
                  generated={job.result}
                  lang={lang}
                  onImageError={() => setImageFailed(true)}
                  onOpenReference={() =>
                    openImage(compared.variant.original, compared.title[lang], compared.variant.id)
                  }
                  onOpenGenerated={() => openImage(job.result!, g.generated, 'generated-character')}
                />
              ) : (
                <>
                  {mode === 'split' && compared && (
                    <div className="studio-result-image">
                      <span className="studio-image-tag">{g[compared.kind]}</span>
                      <button
                        aria-label={`${g.openImage}: ${g[compared.kind]}`}
                        onClick={() =>
                          openImage(
                            compared.variant.original,
                            compared.title[lang],
                            compared.variant.id,
                          )
                        }
                      >
                        <RemoteImage
                          src={compared.variant.image}
                          alt={compared.title[lang]}
                          lang={lang}
                          eager
                          retryable
                        />
                      </button>
                      <ImageDownloadButton
                        source={compared.variant.original}
                        filename={compared.variant.id}
                        lang={lang}
                      />
                    </div>
                  )}
                  <div className="studio-result-image">
                    <span className="studio-image-tag">{g.generated}</span>
                    <button
                      aria-label={`${g.openImage}: ${g.generated}`}
                      onClick={() => openImage(job.result!, g.generated, 'generated-character')}
                    >
                      <img
                        key={`${job.result}-${attempt}`}
                        src={job.result}
                        alt={g.generated}
                        referrerPolicy="no-referrer"
                        onError={() => setImageFailed(true)}
                      />
                    </button>
                  </div>
                </>
              )
            ) : (
              <div className="studio-placeholder studio-empty">
                <div className="studio-empty-composition">
                  {kinds.map((kind, index) => {
                    const ref = references.find((value) => value.kind === kind),
                      Icon = referenceIcons[kind];
                    return (
                      <div key={kind}>
                        {index > 0 && <Plus size={14} />}
                        <button
                          onClick={() => setPicker(kind)}
                          aria-label={`${t.choose} ${g[kind]}`}
                        >
                          {ref ? (
                            <RemoteImage
                              src={ref.variant.thumbnail}
                              alt={ref.title[lang]}
                              lang={lang}
                            />
                          ) : (
                            <Icon size={29} strokeWidth={1.2} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <h2>{t.emptyTitle}</h2>
                <p>{t.emptyHint}</p>
                {!ready && (
                  <button className="secondary-button" onClick={onSettings}>
                    <Settings2 size={15} />
                    {t.noConfig}
                  </button>
                )}
              </div>
            )}
          </div>
          {job && (
            <div className="studio-result-meta">
              <span>
                {loading ? (
                  g.generating
                ) : job.status === 'success' ? (
                  <>
                    <Check size={12} />
                    {g.success}
                  </>
                ) : job.status === 'cancelled' ? (
                  g.cancelled
                ) : (
                  g.failed
                )}
              </span>
              <code>
                {job.model} · {job.size || size}
              </code>
            </div>
          )}
          {job?.result && job.status === 'success' && (
            <>
              <div className="studio-result-actions">
                <ImageDownloadButton
                  source={job.result}
                  filename="generated-character"
                  lang={lang}
                  showLabel
                />
                <button
                  className="secondary-button studio-reuse"
                  disabled={reusing || characterLoading}
                  onClick={() => void reuse()}
                >
                  {reusing ? (
                    <LoaderCircle size={15} className="spinner" />
                  ) : (
                    <UserRound size={15} />
                  )}
                  {reusing ? t.reusing : t.reuse}
                  <ArrowRight size={14} />
                </button>
              </div>
              <p className="studio-result-note">{t.resultHint}</p>
            </>
          )}
        </section>
      </div>
      {historyOpen && (
        <Modal
          onClose={() => setHistoryOpen(false)}
          label={t.history}
          className="studio-history-drawer"
        >
          <section className="studio-history">
            <div className="studio-section-heading">
              <h2>{t.history}</h2>
              <button
                className="icon-button"
                onClick={() => setHistoryOpen(false)}
                aria-label={g.close}
              >
                <X size={17} />
              </button>
            </div>
            <p>{t.historyHint}</p>
            {historyError && (
              <p className="studio-inline-error" role="alert">
                {t.historyFailed}
              </p>
            )}
            <div className="studio-history-grid">
              {history.map((record) => (
                <HistoryThumbnail
                  key={record.id}
                  record={record}
                  lang={lang}
                  onRestore={() => {
                    if (!loading) void restore(record);
                  }}
                  onDelete={() => {
                    void deleteGenerationRecord(record.id)
                      .then(() => {
                        setHistory((rows) => rows.filter((row) => row.id !== record.id));
                        notify(t.historyDeleted);
                      })
                      .catch(() => setHistoryError(true));
                  }}
                />
              ))}
            </div>
            {!history.length && <p>{t.historyEmpty}</p>}
          </section>
        </Modal>
      )}
      {picker && (
        <ReferencePicker
          kind={picker}
          items={items}
          lang={lang}
          onClose={() => setPicker(null)}
          onChoose={(item) => {
            onChoose(item);
            setPicker(null);
          }}
        />
      )}
      {lightbox && <ImageLightbox {...lightbox} lang={lang} onClose={() => setLightbox(null)} />}
    </section>
  );
}
