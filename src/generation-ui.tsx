import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal, RemoteImage } from './ui';
import { generationCopy } from './generation-copy';
import {
  clearImageConfig,
  defaultImageConfig,
  imageEndpoint,
  imageSizes,
  saveImageConfig,
} from './generation';
import type { GenerationJob, ImageConfig, ImageReference } from './generation';
import type { Lang } from './types';

function imageExtension(type: string): string {
  return type === 'image/png'
    ? 'png'
    : type === 'image/jpeg'
      ? 'jpg'
      : type === 'image/webp'
        ? 'webp'
        : 'png';
}

async function downloadImageSource(source: string, filename: string): Promise<void> {
  const url = new URL(source, window.location.href);
  if (!['https:', 'blob:', 'data:'].includes(url.protocol)) throw Error('invalidImageSource');
  const response = await fetch(url.href, {
    signal: AbortSignal.timeout(60_000),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw Error('downloadFailed');
  const blob = await response.blob();
  if (!blob.size || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type))
    throw Error('downloadFailed');
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${filename}.${imageExtension(blob.type)}`;
  const dialogs = document.querySelectorAll('dialog[open]');
  (dialogs[dialogs.length - 1] || document.body).appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function ImageDownloadButton({
  source,
  filename,
  lang,
  label,
  showLabel = false,
}: {
  source: string;
  filename: string;
  lang: Lang;
  label?: string;
  showLabel?: boolean;
}) {
  const t = generationCopy[lang];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inProgress = useRef(false);
  useEffect(() => setFailed(false), [source]);
  return (
    <span className="generation-download-control">
      <button
        type="button"
        className={showLabel ? 'secondary-button' : 'icon-button generation-image-action'}
        aria-label={busy ? t.downloading : label || t.downloadImage}
        title={busy ? t.downloading : label || t.downloadImage}
        aria-busy={busy}
        disabled={busy}
        onClick={async () => {
          if (inProgress.current) return;
          inProgress.current = true;
          setBusy(true);
          setFailed(false);
          try {
            await downloadImageSource(source, filename);
          } catch {
            setFailed(true);
          } finally {
            inProgress.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? <LoaderCircle size={15} className="spinner" /> : <Download size={15} />}
        {showLabel && (busy ? t.downloading : label || t.downloadImage)}
      </button>
      {failed && (
        <span className="generation-download-error" role="alert">
          {t.downloadFailed}
        </span>
      )}
    </span>
  );
}

function ImageLightbox({
  source,
  downloadSource,
  filename,
  alt,
  lang,
  onClose,
}: {
  source: string;
  downloadSource: string;
  filename: string;
  alt: string;
  lang: Lang;
  onClose: () => void;
}) {
  const t = generationCopy[lang];
  const [fullSize, setFullSize] = useState(false);
  return (
    <Modal onClose={onClose} label={t.openImage} className="image-lightbox">
      <div className="image-lightbox-heading">
        <span>{alt}</span>
        <button type="button" className="icon-button" aria-label={t.close} onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className={`image-lightbox-canvas ${fullSize ? 'full-size' : ''}`}>
        <RemoteImage src={source} alt={alt} lang={lang} eager retryable />
      </div>
      <div className="image-lightbox-actions">
        <button
          type="button"
          className="secondary-button"
          aria-pressed={fullSize}
          onClick={() => setFullSize(!fullSize)}
        >
          {fullSize ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
          {fullSize ? t.fitImage : t.actualSize}
        </button>
        <ImageDownloadButton source={downloadSource} filename={filename} lang={lang} showLabel />
      </div>
    </Modal>
  );
}

export function ImageSettings({
  config,
  lang,
  onSave,
  onClear,
  onClose,
}: {
  config: ImageConfig;
  lang: Lang;
  onSave: (config: ImageConfig) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = generationCopy[lang];
  const [draft, setDraft] = useState(config);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  let serviceHomepage = defaultImageConfig.baseUrl;
  try {
    serviceHomepage = new URL(imageEndpoint(draft.baseUrl)).origin;
  } catch {
    // Keep the default service link while an incomplete URL is being edited.
  }
  const update = (key: keyof ImageConfig, value: string | boolean) => {
    setDraft((old) => ({ ...old, [key]: value }));
    setError('');
  };
  return (
    <Modal onClose={onClose} label={t.settings} className="image-settings-modal">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">IMAGE GENERATION</span>
          <h2>{t.settings}</h2>
        </div>
        <button className="icon-button" aria-label={t.close} onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <p className="panel-description">{t.settingsIntro}</p>
      <form
        className="image-settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onSave(saveImageConfig(draft));
          } catch (failure) {
            const code = failure instanceof Error ? failure.message : '';
            setError(
              code === 'missingConfig' || code === 'invalidConfig'
                ? t[code]
                : code === 'invalidEndpoint' || failure instanceof TypeError
                  ? t.invalidEndpoint
                  : t.storageFailed,
            );
          }
        }}
      >
        <label>
          {t.baseUrl}
          <input
            type="url"
            required
            autoComplete="off"
            placeholder="https://api.example.com/v1"
            value={draft.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
          />
        </label>
        <div className="api-key-field">
          <div className="api-key-label">
            <label htmlFor="image-api-key">{t.apiKey}</label>
            <a href={serviceHomepage} target="_blank" rel="noopener noreferrer">
              {t.getApiKey}
            </a>
          </div>
          <span className="api-key-input">
            <input
              id="image-api-key"
              type={showKey ? 'text' : 'password'}
              required
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={showKey ? t.hideKey : t.showKey}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </div>
        <label>
          {t.model}
          <input
            required
            autoComplete="off"
            value={draft.model}
            onChange={(e) => update('model', e.target.value)}
          />
        </label>
        <div className="image-settings-row">
          <label>
            {t.size}
            <select value={draft.size} onChange={(e) => update('size', e.target.value)}>
              {imageSizes.map((size) => (
                <option key={size} value={size}>
                  {size === 'auto' ? t.auto : size}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.quality}
            <select value={draft.quality} onChange={(e) => update('quality', e.target.value)}>
              {(['auto', 'low', 'medium', 'high'] as const).map((quality) => (
                <option key={quality} value={quality}>
                  {t[quality]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="remember-key">
          <input
            type="checkbox"
            checked={draft.rememberKey}
            onChange={(e) => update('rememberKey', e.target.checked)}
          />
          {t.rememberKey}
        </label>
        <p className="settings-note">{t.privacy}</p>
        <p className="settings-note">{t.compatibility}</p>
        {error && (
          <p className="generation-error" role="alert">
            {error}
          </p>
        )}
        <div className="image-settings-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              try {
                clearImageConfig();
                setDraft({ ...defaultImageConfig });
                onClear();
              } catch {
                setError(t.storageFailed);
              }
            }}
          >
            {t.clear}
          </button>
          <button className="primary-button" type="submit">
            <Check size={16} />
            {t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ComparisonWipe({
  reference,
  generated,
  lang,
  onImageError,
  onOpenReference,
  onOpenGenerated,
}: {
  reference: GenerationJob['references'][number];
  generated: string;
  lang: Lang;
  onImageError: () => void;
  onOpenReference: () => void;
  onOpenGenerated: () => void;
}) {
  const t = generationCopy[lang];
  const [position, setPosition] = useState(50);
  return (
    <div className="comparison-wipe">
      <div className="comparison-wipe-layer">
        <RemoteImage
          src={reference.variant.image}
          alt={reference.title[lang]}
          lang={lang}
          eager
          retryable
        />
      </div>
      <div
        className="comparison-wipe-layer comparison-wipe-generated"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img
          src={generated}
          alt={t.generated}
          referrerPolicy="no-referrer"
          onError={onImageError}
        />
      </div>
      <div className="comparison-wipe-label generated">
        <button
          type="button"
          aria-label={`${t.openImage}: ${t.generated}`}
          title={t.openImage}
          onClick={onOpenGenerated}
        >
          <Maximize2 size={13} />
          {t.generated}
        </button>
        <ImageDownloadButton
          source={generated}
          filename="generated-character"
          lang={lang}
          label={`${t.downloadImage}: ${t.generated}`}
        />
      </div>
      <div className="comparison-wipe-label reference">
        <button
          type="button"
          aria-label={`${t.openImage}: ${t.reference}`}
          title={t.openImage}
          onClick={onOpenReference}
        >
          <Maximize2 size={13} />
          {t.reference}
        </button>
        <ImageDownloadButton
          source={reference.variant.original}
          filename={reference.variant.id}
          lang={lang}
          label={`${t.downloadImage}: ${t.reference}`}
        />
      </div>
      <div className="comparison-wipe-divider" style={{ left: `${position}%` }} aria-hidden="true">
        <span>
          <ArrowLeftRight size={19} />
        </span>
      </div>
      <input
        className="comparison-wipe-range"
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label={t.comparisonSlider}
        aria-valuetext={`${t.generated} ${position}% · ${t.reference} ${100 - position}%`}
        onChange={(event) => setPosition(Number(event.target.value))}
      />
    </div>
  );
}

export function GenerationDialog({
  job,
  lang,
  onRun,
  onClose,
}: {
  job: GenerationJob;
  lang: Lang;
  onRun: (prompt: string) => void;
  onClose: () => void;
}) {
  const t = generationCopy[lang];
  const [activeKind, setActiveKind] = useState<ImageReference['kind']>(job.references[0].kind);
  const [prompt, setPrompt] = useState(job.prompt);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const [previewMode, setPreviewMode] = useState<'split' | 'overlay'>('split');
  const [lightbox, setLightbox] = useState<{
    source: string;
    downloadSource: string;
    filename: string;
    alt: string;
  } | null>(null);
  const active = job.references.find((ref) => ref.kind === activeKind) || job.references[0];
  const loading = job.status === 'loading';
  const openReference = () =>
    setLightbox({
      source: active.variant.original,
      downloadSource: active.variant.original,
      filename: active.variant.id,
      alt: active.title[lang],
    });
  const openGenerated = () => {
    if (job.status === 'success' && job.result)
      setLightbox({
        source: job.result,
        downloadSource: job.result,
        filename: 'generated-character',
        alt: t.generated,
      });
  };
  return (
    <Modal
      onClose={lightbox ? () => setLightbox(null) : onClose}
      label={t.generate}
      className="generation-modal"
    >
      <div className="generation-heading">
        <div>
          <span className="section-kicker">REFERENCE STUDIO</span>
          <h2>{t.generate}</h2>
        </div>
        <button className="icon-button" aria-label={t.close} onClick={onClose}>
          <X size={22} />
        </button>
      </div>
      <p className="settings-note">
        {t.model}: <code>{job.model}</code> · {t.referenceCount}: {job.references.length}
      </p>
      <div className="generation-preview-toolbar">
        <div className="generation-preview-switch" role="group" aria-label={t.previewMode}>
          <button
            type="button"
            aria-pressed={previewMode === 'split'}
            onClick={() => setPreviewMode('split')}
          >
            {t.sideBySide}
          </button>
          <button
            type="button"
            aria-pressed={previewMode === 'overlay'}
            onClick={() => setPreviewMode('overlay')}
          >
            {t.overlay}
          </button>
        </div>
      </div>
      <div className={`generation-comparison ${previewMode === 'overlay' ? 'overlay-mode' : ''}`}>
        <div className="generation-thumbnails" aria-label={t.reference}>
          {job.references.map((ref) => {
            const kind = ref.kind;
            return (
              <button
                key={kind}
                className={`generation-thumbnail ${active.kind === kind ? 'active' : ''}`}
                aria-pressed={active.kind === kind}
                aria-label={t[kind]}
                onClick={() => setActiveKind(kind)}
              >
                <RemoteImage src={ref.variant.thumbnail} alt={ref.title[lang]} lang={lang} eager />
                <span>{t[kind]}</span>
              </button>
            );
          })}
        </div>
        {previewMode === 'split' && (
          <section className="generation-frame">
            <div className="generation-frame-heading">
              <span>{t.reference}</span>
              <div className="generation-frame-tools">
                <code>{active.variant.id}</code>
                <button
                  type="button"
                  className="icon-button generation-image-action"
                  aria-label={`${t.openImage}: ${t.reference}`}
                  title={t.openImage}
                  onClick={openReference}
                >
                  <Maximize2 size={15} />
                </button>
                <ImageDownloadButton
                  source={active.variant.original}
                  filename={active.variant.id}
                  lang={lang}
                  label={`${t.downloadImage}: ${t.reference}`}
                />
              </div>
            </div>
            <div className="generation-canvas">
              <button
                type="button"
                className="generation-image-button"
                aria-label={`${t.openImage}: ${active.title[lang]}`}
                onClick={openReference}
              >
                <RemoteImage
                  src={active.variant.image}
                  alt={active.title[lang]}
                  lang={lang}
                  eager
                />
              </button>
            </div>
            <p className="generation-caption">{active.title[lang]}</p>
          </section>
        )}
        <section className={`generation-frame generation-output ${job.status}`} aria-busy={loading}>
          <div className="generation-frame-heading">
            <span>{previewMode === 'overlay' ? t.overlay : t.generated}</span>
            <div className="generation-frame-tools">
              {previewMode === 'split' && job.status === 'success' && job.result && (
                <>
                  <button
                    type="button"
                    className="icon-button generation-image-action"
                    aria-label={`${t.openImage}: ${t.generated}`}
                    title={t.openImage}
                    onClick={openGenerated}
                  >
                    <Maximize2 size={15} />
                  </button>
                  <ImageDownloadButton
                    source={job.result}
                    filename="generated-character"
                    lang={lang}
                    label={`${t.downloadImage}: ${t.generated}`}
                  />
                </>
              )}
              <span className="generation-status" role="status">
                {loading ? (
                  <LoaderCircle size={13} className="spinner" />
                ) : job.status === 'success' ? (
                  <Check size={13} />
                ) : (
                  <RotateCcw size={13} />
                )}
                {loading ? t.generating : job.status === 'success' ? t.success : t.failed}
              </span>
            </div>
          </div>
          <div
            className={`generation-canvas ${previewMode === 'overlay' && job.status === 'success' && !imageFailed ? 'generation-overlay-canvas' : ''}`}
          >
            {loading ? (
              <div className="generation-placeholder">
                <LoaderCircle size={29} className="spinner" />
                <h3>{t.waiting}</h3>
                <p>{t.waitingHint}</p>
              </div>
            ) : job.status === 'error' ? (
              <div className="generation-placeholder" role="alert">
                <RotateCcw size={28} />
                <h3>{t.failed}</h3>
                <p>{job.error}</p>
                <button
                  className="primary-button"
                  onClick={() => onRun(prompt)}
                  disabled={!prompt.trim()}
                >
                  <RotateCcw size={15} />
                  {t.retry}
                </button>
              </div>
            ) : imageFailed ? (
              <div className="generation-placeholder">
                <p>{t.imageFailed}</p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setImageFailed(false);
                    setImageAttempt((v) => v + 1);
                  }}
                >
                  {t.retryImage}
                </button>
              </div>
            ) : previewMode === 'overlay' && job.result ? (
              <ComparisonWipe
                key={`${job.result}-${imageAttempt}`}
                reference={active}
                generated={job.result}
                lang={lang}
                onImageError={() => setImageFailed(true)}
                onOpenReference={openReference}
                onOpenGenerated={openGenerated}
              />
            ) : (
              <button
                type="button"
                className="generation-image-button"
                aria-label={`${t.openImage}: ${t.generated}`}
                onClick={openGenerated}
              >
                <img
                  key={`${job.result}-${imageAttempt}`}
                  src={job.result}
                  alt={t.generated}
                  referrerPolicy="no-referrer"
                  onError={() => setImageFailed(true)}
                />
              </button>
            )}
          </div>
        </section>
      </div>
      <p className="generation-reference-hint">
        {previewMode === 'overlay' ? t.overlayHint : t.referenceHint}
      </p>
      <div className="generation-prompt">
        <label htmlFor="generation-prompt">{t.prompt}</label>
        <textarea
          id="generation-prompt"
          value={prompt}
          disabled={loading}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
        <button
          className="primary-button"
          disabled={loading || !prompt.trim()}
          onClick={() => {
            setImageFailed(false);
            onRun(prompt);
          }}
        >
          {loading ? (
            <LoaderCircle size={16} className="spinner" />
          ) : job.status === 'error' ? (
            <RotateCcw size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          {loading ? t.generating : job.status === 'error' ? t.retry : t.regenerate}
        </button>
      </div>
      {lightbox && (
        <ImageLightbox
          source={lightbox.source}
          downloadSource={lightbox.downloadSource}
          filename={lightbox.filename}
          alt={lightbox.alt}
          lang={lang}
          onClose={() => setLightbox(null)}
        />
      )}
    </Modal>
  );
}

export function ImageSettingsButton({
  lang,
  ready,
  onClick,
}: {
  lang: Lang;
  ready: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`image-settings-button icon-button ${ready ? 'configured' : ''}`}
      aria-label={generationCopy[lang].settings}
      title={generationCopy[lang].settings}
      onClick={onClick}
    >
      <Settings size={18} />
      {ready && <span className="settings-ready-dot" />}
    </button>
  );
}
