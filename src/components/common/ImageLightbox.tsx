import React, { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Lightbox overlay for viewing article images at full resolution.
 *
 * Usage: wrap a content container with <LightboxContainer>. Any <img> inside
 * that is larger than 200px wide (i.e. figure images, not inline icons) will
 * become clickable and opens in a full-screen lightbox. The lightbox tries to
 * upgrade the image to the -xl variant when the src ends with -lg.png/.webp
 * so readers get the best available resolution.
 *
 * Interactions:
 *   - Wheel / pinch-zoom: zoom in/out around cursor
 *   - Double-click: toggle 1× ↔ 2.5× zoom at click point
 *   - Drag: pan when zoomed in
 *   - +/- keys: zoom in/out; 0 or R: reset; ESC: close
 *   - Toolbar buttons: zoom in, zoom out, reset, close
 */

interface LightboxState {
  src: string;
  alt: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const DBL_CLICK_ZOOM = 2.5;

function upgradeToXl(src: string): string {
  return src.replace(/-(?:lg|md|sm)\.(png|webp|jpg|jpeg)(\?.*)?$/, '-xl.$1$2');
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function LightboxContainer({ children }: { children: React.ReactNode }) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'IMG') return;
    const img = target as HTMLImageElement;
    if (img.naturalWidth > 0 && img.naturalWidth < 200) return;
    if (img.closest('a')) return;
    e.preventDefault();
    const src = img.currentSrc || img.src;
    setLightbox({ src: upgradeToXl(src), alt: img.alt || '' });
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const imgs = root.querySelectorAll('img');
    imgs.forEach((img) => {
      if (img.dataset.lightboxReady) return;
      const w = img.getAttribute('width') || img.naturalWidth;
      if (typeof w === 'number' && w > 0 && w < 200) return;
      img.style.cursor = 'zoom-in';
      if (!img.title) img.title = 'Click to enlarge';
      img.dataset.lightboxReady = '1';
    });
  });

  const close = useCallback(() => setLightbox(null), []);

  return (
    <>
      <div ref={containerRef} onClick={handleContainerClick} style={{ display: 'contents' }}>
        {children}
      </div>
      {lightbox && <Lightbox data={lightbox} onClose={close} />}
    </>
  );
}

// ---------- Lightbox viewer with zoom + pan ----------

function Lightbox({ data, onClose }: { data: LightboxState; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);

  // Reset transform when image changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [data.src]);

  // Global keys + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM));
      else if (e.key === '-' || e.key === '_') setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM));
      else if (e.key === '0' || e.key === 'r' || e.key === 'R') {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Wheel zoom — pivot around cursor
  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      setZoom((prevZoom) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = clamp(prevZoom * factor, MIN_ZOOM, MAX_ZOOM);
        const ratio = next / prevZoom;
        setOffset((o) => ({
          x: cx - (cx - o.x) * ratio,
          y: cy - (cy - o.y) * ratio,
        }));
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imgRef.current) return;
    if (zoom > 1) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }
    const rect = imgRef.current.getBoundingClientRect();
    const cx = e.clientX - (rect.left + rect.width / 2);
    const cy = e.clientY - (rect.top + rect.height / 2);
    const ratio = DBL_CLICK_ZOOM;
    setZoom(DBL_CLICK_ZOOM);
    setOffset({ x: -cx * (ratio - 1), y: -cy * (ratio - 1) });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      });
    };
    const onUp = () => {
      setIsDragging(false);
      dragStart.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // Touch gestures: 1-finger drag (when zoomed), 2-finger pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchRef.current = { startDist: dist, startZoom: zoom };
    } else if (e.touches.length === 1 && zoom > 1) {
      const t = e.touches[0];
      dragStart.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const next = clamp((dist / pinchRef.current.startDist) * pinchRef.current.startZoom, MIN_ZOOM, MAX_ZOOM);
      setZoom(next);
    } else if (e.touches.length === 1 && isDragging && dragStart.current) {
      const t = e.touches[0];
      setOffset({
        x: dragStart.current.ox + (t.clientX - dragStart.current.x),
        y: dragStart.current.oy + (t.clientY - dragStart.current.y),
      });
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
    setIsDragging(false);
    dragStart.current = null;
  };

  const zoomIn = () => setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM));
  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Click on backdrop (not image, not toolbar) to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const imgCursor = zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10, 15, 25, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        animation: 'lb-fade 0.15s ease-out',
        overflow: 'hidden',
      }}
    >
      <img
        ref={imgRef}
        src={data.src}
        alt={data.alt}
        draggable={false}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          maxWidth: '95vw',
          maxHeight: '92vh',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          cursor: imgCursor,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          userSelect: 'none',
          willChange: 'transform',
          touchAction: 'none',
        }}
      />

      {/* Toolbar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          padding: '0.5rem 0.75rem',
          borderRadius: '999px',
          color: '#fff',
          fontSize: '0.9rem',
        }}
      >
        <ToolbarButton onClick={zoomOut} disabled={zoom <= MIN_ZOOM} title="Zoom out (−)" aria-label="Zoom out">−</ToolbarButton>
        <button
          onClick={reset}
          title="Reset zoom (0)"
          aria-label="Reset zoom"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: '0 0.5rem',
            minWidth: '3.25rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <ToolbarButton onClick={zoomIn} disabled={zoom >= MAX_ZOOM} title="Zoom in (+)" aria-label="Zoom in">+</ToolbarButton>
        <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.2)', margin: '0 0.25rem' }} />
        <ToolbarButton onClick={onClose} title="Close (Esc)" aria-label="Close">✕</ToolbarButton>
      </div>

      {/* Hint (top-left) */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          color: 'rgba(255,255,255,0.55)',
          fontSize: '0.75rem',
          lineHeight: 1.5,
          pointerEvents: 'none',
        }}
      >
        Scroll to zoom · Drag to pan · Double-click to toggle
      </div>

      <style>{`@keyframes lb-fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...rest}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: 'none',
        background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.15)',
        color: disabled ? 'rgba(255,255,255,0.35)' : '#fff',
        fontSize: '1.1rem',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
