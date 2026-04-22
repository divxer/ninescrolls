import React, { useEffect, useState, useCallback } from 'react';

/**
 * Lightbox overlay for viewing article images at full resolution.
 *
 * Usage: wrap a content container with <LightboxContainer>. Any <img> inside
 * that is larger than 200px wide (i.e. figure images, not inline icons) will
 * become clickable and opens in a full-screen lightbox. The lightbox tries to
 * upgrade the image to the -xl variant when the src ends with -lg.png/.webp
 * so readers get the best available resolution.
 */

interface LightboxState {
  src: string;
  alt: string;
}

// Upgrade -lg to -xl, or -md to -xl when available; fall back to original
function upgradeToXl(src: string): string {
  return src.replace(/-(?:lg|md|sm)\.(png|webp|jpg|jpeg)(\?.*)?$/, '-xl.$1$2');
}

export function LightboxContainer({ children }: { children: React.ReactNode }) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const img = target as HTMLImageElement;
    // Skip tiny images (icons, avatars) — only lightbox real figures
    if (img.naturalWidth > 0 && img.naturalWidth < 200) return;
    // Skip if the img is inside an anchor (let the link work)
    if (img.closest('a')) return;
    e.preventDefault();
    const src = img.currentSrc || img.src;
    setLightbox({ src: upgradeToXl(src), alt: img.alt || '' });
  }, []);

  // Add hover cursor + title to figure images after mount / content change
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const imgs = root.querySelectorAll('img');
    imgs.forEach((img) => {
      // Skip if already set or if small
      if (img.dataset.lightboxReady) return;
      const w = img.getAttribute('width') || img.naturalWidth;
      if (typeof w === 'number' && w > 0 && w < 200) return;
      img.style.cursor = 'zoom-in';
      if (!img.title) img.title = 'Click to enlarge';
      img.dataset.lightboxReady = '1';
    });
  });

  const close = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightbox, close]);

  return (
    <>
      <div ref={containerRef} onClick={handleContainerClick} style={{ display: 'contents' }}>
        {children}
      </div>
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(10, 15, 25, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            cursor: 'zoom-out',
            animation: 'lb-fade 0.15s ease-out',
          }}
        >
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            style={{
              maxWidth: '95vw',
              maxHeight: '92vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              cursor: 'zoom-out',
            }}
            onClick={(e) => {
              // Click on image itself also closes — unified behaviour
              e.stopPropagation();
              close();
            }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <style>{`@keyframes lb-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
        </div>
      )}
    </>
  );
}
