import { useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  PersonStanding,
  RotateCcw,
  Settings,
  Shirt,
  Sparkles,
  X,
} from 'lucide-react';
import { Modal, RemoteImage } from './ui';
import { generationCopy } from './generation-copy';
import {
  clearImageConfig,
  defaultImageConfig,
  imageSizes,
  isGrokImageModel,
  saveImageConfig,
} from './generation';
import type { GenerationJob, ImageConfig } from './generation';
import type { Kind, Lang } from './types';

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
        <label>
          {t.apiKey}
          <span className="api-key-input">
            <input
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
        </label>
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
            <select
              disabled={isGrokImageModel(draft.model)}
              value={draft.quality}
              onChange={(e) => update('quality', e.target.value)}
            >
              {(['auto', 'low', 'medium', 'high'] as const).map((quality) => (
                <option key={quality} value={quality}>
                  {t[quality]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isGrokImageModel(draft.model) && <p className="settings-note">{t.grokOptions}</p>}
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
  const [activeKind, setActiveKind] = useState<Kind>(job.references[0].kind);
  const [prompt, setPrompt] = useState(job.prompt);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  const active = job.references.find((ref) => ref.kind === activeKind) || job.references[0];
  const loading = job.status === 'loading';
  return (
    <Modal onClose={onClose} label={t.generate} className="generation-modal">
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
        {t.model}: <code>{job.model}</code>
      </p>
      <div className="generation-comparison">
        <div className="generation-thumbnails" aria-label={t.reference}>
          {(['pose', 'costume'] as const).map((kind) => {
            const ref = job.references.find((value) => value.kind === kind);
            return (
              <button
                key={kind}
                className={`generation-thumbnail ${active.kind === kind ? 'active' : ''}`}
                disabled={!ref}
                aria-pressed={active.kind === kind}
                aria-label={kind === 'pose' ? t.pose : t.costume}
                onClick={() => setActiveKind(kind)}
              >
                {ref ? (
                  <RemoteImage
                    src={ref.variant.thumbnail}
                    alt={ref.title[lang]}
                    lang={lang}
                    eager
                  />
                ) : (
                  <span className="generation-missing">
                    {kind === 'pose' ? <PersonStanding size={25} /> : <Shirt size={25} />}
                  </span>
                )}
                <span>
                  {ref
                    ? kind === 'pose'
                      ? t.pose
                      : t.costume
                    : kind === 'pose'
                      ? t.missingPose
                      : t.missingCostume}
                </span>
              </button>
            );
          })}
        </div>
        <section className="generation-frame">
          <div className="generation-frame-heading">
            <span>{t.reference}</span>
            <code>{active.variant.id}</code>
          </div>
          <div className="generation-canvas">
            <RemoteImage
              src={active.variant.image}
              alt={active.title[lang]}
              lang={lang}
              eager
              retryable
            />
          </div>
          <p className="generation-caption">{active.title[lang]}</p>
        </section>
        <section className={`generation-frame generation-output ${job.status}`} aria-busy={loading}>
          <div className="generation-frame-heading">
            <span>{t.generated}</span>
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
          <div className="generation-canvas">
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
            ) : (
              <img
                key={`${job.result}-${imageAttempt}`}
                src={job.result}
                alt={t.generated}
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
              />
            )}
          </div>
        </section>
      </div>
      <p className="generation-reference-hint">{t.referenceHint}</p>
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
