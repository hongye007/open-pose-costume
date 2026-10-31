import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ImagePlus, LoaderCircle, Shirt, Sparkles, X } from 'lucide-react';
import { Modal } from './ui';
import { studioCopy } from './studio-copy';
import { generationCopy } from './generation-copy';
import type { Lang } from './types';

function useFilePreview(file: File | null) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : '';
    setPreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  return preview;
}

export function CostumeExtractionDialog({
  lang,
  file,
  result,
  loading,
  error,
  onUpload,
  onExtract,
  onConfirm,
  onClose,
}: {
  lang: Lang;
  file: File | null;
  result: File | null;
  loading: boolean;
  error: string;
  onUpload: (file: File) => void;
  onExtract: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = studioCopy[lang];
  const original = useFilePreview(file);
  const extracted = useFilePreview(result);
  const input = useRef<HTMLInputElement>(null);
  return (
    <Modal label={t.extractCostume} className="costume-extraction-modal" onClose={onClose}>
      <div className="panel-heading">
        <h2>{t.extractCostume}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={generationCopy[lang].close}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <p className="costume-extraction-intro">{t.extractionIntro}</p>
      <div className="costume-extraction-grid">
        <section>
          <h3>{t.extractionInput}</h3>
          <button
            type="button"
            className="costume-extraction-preview costume-extraction-input"
            aria-label={file ? t.replaceExtractionInput : t.chooseExtractionInput}
            disabled={loading}
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              if (!loading) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!loading && event.dataTransfer.files[0]) onUpload(event.dataTransfer.files[0]);
            }}
            onPaste={(event) => {
              if (!loading && event.clipboardData.files[0]) {
                event.preventDefault();
                onUpload(event.clipboardData.files[0]);
              }
            }}
          >
            {original ? (
              <>
                <img src={original} alt={t.extractionInput} />
                <span className="costume-extraction-replace">
                  <ImagePlus size={14} />
                  {t.replaceExtractionInput}
                </span>
              </>
            ) : (
              <div className="costume-extraction-empty">
                <ImagePlus size={34} strokeWidth={1.3} />
                <p>{t.chooseExtractionInput}</p>
                <small>{t.extractionInputHint}</small>
              </div>
            )}
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={loading}
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = '';
              if (next) onUpload(next);
            }}
          />
        </section>
        <div className="costume-extraction-trigger">
          <button
            type="button"
            className="primary-button"
            disabled={loading || !file}
            onClick={onExtract}
          >
            {loading ? <LoaderCircle size={16} className="spinner" /> : <Sparkles size={16} />}
            {loading
              ? t.extractingCostume
              : error
                ? t.retryExtraction
                : result
                  ? t.extractAgain
                  : t.extractCostume}
            {!loading && <ArrowRight size={15} />}
          </button>
        </div>
        <section>
          <h3>{t.extractionOutput}</h3>
          <div className="costume-extraction-preview" aria-busy={loading}>
            {extracted ? (
              <img src={extracted} alt={t.extractionOutput} />
            ) : (
              <div className="costume-extraction-empty" role="status">
                {loading ? (
                  <LoaderCircle size={28} className="spinner" />
                ) : (
                  <Shirt size={34} strokeWidth={1.3} />
                )}
                <p>{loading ? t.extractingCostume : t.extractionEmpty}</p>
              </div>
            )}
          </div>
        </section>
      </div>
      {error && (
        <p className="studio-inline-error" role="alert">
          {error}
        </p>
      )}
      {result && !loading && (
        <p className="costume-extraction-success" role="status">
          <Check size={15} />
          {t.extractionReady}
        </p>
      )}
      <p className="costume-extraction-note">{t.costumeExtractionHint}</p>
      <div className="costume-extraction-footer">
        <button type="button" className="secondary-button" onClick={onClose}>
          {t.cancelExtraction}
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!result || loading}
          onClick={onConfirm}
        >
          <Check size={16} />
          {t.confirmCostume}
        </button>
      </div>
    </Modal>
  );
}
