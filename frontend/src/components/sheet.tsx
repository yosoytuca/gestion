import type {ComponentChildren} from 'preact';
import {useEffect, useRef} from 'preact/hooks';
export function Sheet({title, close, children}: {title: string; close(): void; children: ComponentChildren}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current!;
    const focusable = () => [...element.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,textarea,[tabindex="0"]')];
    (focusable()[0] ?? element).focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); close();}
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }
    };
    element.addEventListener('keydown', key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => {element.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus();};
  }, []);
  return <div class="overlay" onClick={e => {if (e.target === e.currentTarget) close();}}>
    <section ref={ref} role="dialog" aria-modal="true" aria-label={title} class="sheet" tabIndex={-1}>
      <div class="sheet-handle"/><header class="sheet-title"><h2>{title}</h2><button class="icon-button" aria-label="Cerrar panel" onClick={close}>×</button></header>
      {children}
    </section>
  </div>;
}
