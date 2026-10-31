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
  Settings,
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
import type { GenerationJob, ImageConfig } from './generation';
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

export function ImageDownloadButton({
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

export function ImageLightbox({
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

export function ComparisonWipe({
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
