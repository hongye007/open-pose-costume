import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { copy } from './i18n';
import type { Lang } from './types';

export function RemoteImage({
  src,
  alt,
  lang,
  className = '',
  eager = false,
  retryable = false,
}: {
  src: string;
  alt: string;
  lang: Lang;
  className?: string;
  eager?: boolean;
  retryable?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [src]);
  return failed ? (
    <div className={`image-fallback ${className}`}>
      <Info size={22} />
      <span>{copy[lang].imageError}</span>
      {retryable && (
        <button
          onClick={() => {
            setFailed(false);
            setAttempt((v) => v + 1);
          }}
        >
          {copy[lang].retryImage}
        </button>
      )}
    </div>
  ) : (
    <img
      key={`${src}-${attempt}`}
      className={className}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function Modal({
  children,
  onClose,
  label,
  className = '',
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const originalOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = originalOverflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div className="modal-inner">{children}</div>
    </dialog>
  );
}
