/* ==========================================================================
   Image gallery with a real interaction: hover reveals the label and lifts the
   frame; clicking opens a lightbox (Escape / backdrop / close button). Images
   are stand-in photography under the Pexels License (see public/images).
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import { useI18n } from '../lib/i18n.js';

interface GalleryItem {
  src: string;
  width: number;
  height: number;
  labelKey: string;
  size: 'large' | 'tall' | 'small' | 'wide';
}

const ITEMS: GalleryItem[] = [
  { src: '/images/pottery-workshop.jpg', width: 1600, height: 1200, labelKey: 'landing.gallery.room', size: 'large' },
  { src: '/images/pottery-terracotta.jpg', width: 1200, height: 1800, labelKey: 'landing.gallery.fresh', size: 'tall' },
  { src: '/images/pottery-studio.jpg', width: 1600, height: 1067, labelKey: 'landing.gallery.shelves', size: 'small' },
  { src: '/images/pottery-trimming.jpg', width: 1600, height: 954, labelKey: 'landing.gallery.trimming', size: 'small' },
  { src: '/images/pottery-detail.jpg', width: 1600, height: 1067, labelKey: 'landing.gallery.detail', size: 'wide' },
];

export function WorkshopGallery() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    closedRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [openIndex]);

  const open = openIndex === null ? null : ITEMS[openIndex] ?? null;

  return (
    <>
      <section className="gallery" aria-labelledby="gallery-title" data-reveal>
        <div className="gallery__head">
          <h2 id="gallery-title">{t('landing.gallery.title')}</h2>
          <p className="muted">{t('landing.gallery.intro')}</p>
        </div>
        <ul className="gallery__grid">
          {ITEMS.map((item, index) => (
            <li key={item.src} className={`gallery__cell gallery__cell--${item.size}`}>
              <button
                type="button"
                className="gallery__item"
                onClick={() => setOpenIndex(index)}
                aria-label={`${t(item.labelKey)} — ${t('landing.gallery.open')}`}
              >
                <img src={item.src} alt="" width={item.width} height={item.height} loading="lazy" />
                <span className="gallery__overlay">
                  <span className="gallery__label">{t(item.labelKey)}</span>
                  <Maximize2 size={15} strokeWidth={2} aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {open
        ? createPortal(
            <div className="lightbox" role="dialog" aria-modal="true" aria-label={t('landing.gallery.dialog')} onClick={() => setOpenIndex(null)}>
              <figure className="lightbox__figure" onClick={(event) => event.stopPropagation()}>
                <img src={open.src} alt="" width={open.width} height={open.height} />
                <figcaption className="lightbox__caption">
                  <span>{t(open.labelKey)}</span>
                  <span className="lightbox__credit">{t('landing.gallery.credit')}</span>
                </figcaption>
                <button
                  ref={closedRef}
              type="button"
              className="lightbox__close"
                  onClick={() => setOpenIndex(null)}
                  aria-label={t('landing.gallery.close')}
                >
                  <X size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </figure>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
