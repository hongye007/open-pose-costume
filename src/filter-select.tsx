import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
  group?: string;
}

/** A compact filter with a native top-layer popover, including inside dialogs. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  lang,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  lang: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [position, setPosition] = useState<CSSProperties>({});
  const typing = useRef({ text: '', time: 0 });
  const selected = options.find((option) => option.value === value);
  const enabled = options.filter((option) => !option.disabled);
  const optionId = (key: string) => `${id}-${options.findIndex((option) => option.value === key)}`;

  function close() {
    menu.current?.hidePopover();
    setOpen(false);
  }
  function show(last = false) {
    const bounds = trigger.current!.getBoundingClientRect();
    const gap = 6;
    const below = window.innerHeight - bounds.bottom - gap - 12;
    const above = bounds.top - gap - 12;
    const upward = below < 220 && above > below;
    const width = Math.min(Math.max(bounds.width, 224), window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)),
      top: upward ? undefined : bounds.bottom + gap,
      bottom: upward ? window.innerHeight - bounds.top + gap : undefined,
      width,
      maxHeight: Math.max(80, Math.min(344, upward ? above : below)),
    });
    setActive(
      selected && !selected.disabled ? value : (last ? enabled.at(-1) : enabled[0])?.value || '',
    );
    menu.current!.showPopover();
    setOpen(true);
  }
  function choose(key: string) {
    if (options.find((option) => option.value === key)?.disabled) return;
    onChange(key);
    close();
    trigger.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!open) return;
    const list = menu.current;
    const option = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !option) return;
    // Only scroll the menu: scrollIntoView can move the page on small screens,
    // which would immediately dismiss this popover through the scroll listener.
    const bounds = list.getBoundingClientRect();
    const activeBounds = option.getBoundingClientRect();
    if (activeBounds.top < bounds.top + 5)
      list.scrollTop -= bounds.top + 5 - activeBounds.top;
    else if (activeBounds.bottom > bounds.bottom - 5)
      list.scrollTop += activeBounds.bottom - bounds.bottom + 5;
  }, [active, open]);
  useEffect(() => {
    if (!open) return;
    const anchor = trigger.current?.getBoundingClientRect();
    const dismiss = (event: Event) => {
      if (event.type === 'scroll') {
        if (menu.current?.contains(event.target as Node)) return;
        const current = trigger.current?.getBoundingClientRect();
        // Browsers can emit a page scroll event when opening a top-layer menu
        // without moving the anchor. Keep the menu open in that case.
        if (
          anchor &&
          current &&
          Math.abs(anchor.top - current.top) < 0.5 &&
          Math.abs(anchor.left - current.left) < 0.5
        )
          return;
      }
      menu.current?.hidePopover();
      setOpen(false);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') {
      if (open) close();
      return;
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) {
        show(event.key === 'ArrowUp' || event.key === 'End');
        return;
      }
      const index = enabled.findIndex((option) => option.value === active);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? enabled.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
      setActive(enabled[next]?.value || '');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (
      open &&
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const now = Date.now();
      typing.current = {
        text:
          (now - typing.current.time < 600 ? typing.current.text : '') +
          event.key.toLocaleLowerCase(),
        time: now,
      };
      const match = enabled.find((option) =>
        option.label.toLocaleLowerCase().startsWith(typing.current.text),
      );
      if (match) setActive(match.value);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`filter-select-trigger ${value !== 'all' ? 'has-value' : ''}`}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-activedescendant={open && active ? optionId(active) : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (open) close();
        }}
      >
        <span className="filter-select-value">{selected?.label || value}</span>
        {selected?.count !== undefined && (
          <span className="filter-select-count">{selected.count.toLocaleString(lang)}</span>
        )}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div
        id={id}
        ref={menu}
        popover="auto"
        role="listbox"
        aria-label={label}
        className="filter-select-menu"
        style={position}
        onToggle={(event) => setOpen(event.newState === 'open')}
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <div key={option.value} role="presentation">
            {option.group && options[index - 1]?.group !== option.group && (
              <div className="filter-select-group" role="presentation">
                {option.group}
              </div>
            )}
            <div
              id={optionId(option.value)}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              data-active={active === option.value}
              className="filter-select-option"
              onMouseEnter={() => {
                if (!option.disabled) setActive(option.value);
              }}
              onClick={() => choose(option.value)}
            >
              <span className="filter-select-check">
                {option.value === value && <Check size={14} aria-hidden="true" />}
              </span>
              <span className="filter-select-option-label">{option.label}</span>
              {option.count !== undefined && (
                <span className="filter-select-count">{option.count.toLocaleString(lang)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
