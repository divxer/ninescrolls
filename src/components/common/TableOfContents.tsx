import React, { useEffect, useState, useRef, useCallback } from 'react';
import '../../styles/TableOfContents.css';

interface TocItem {
  id: string;
  text: string;
  level: number; // 2 for h2, 3 for h3
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function TableOfContents() {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const tocListRef = useRef<HTMLUListElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Build TOC items from headings and assign IDs
  useEffect(() => {
    const headings = document.querySelectorAll('.post-content h2, .post-content h3');
    if (headings.length === 0) return;

    const usedIds = new Set<string>();
    const tocItems: TocItem[] = [];

    headings.forEach(h => {
      // Skip the inline "Table of Contents" heading
      if (h.tagName === 'H2' && h.textContent?.trim() === 'Table of Contents') return;

      let id = h.id || slugify(h.textContent || '');
      if (usedIds.has(id)) {
        let i = 2;
        while (usedIds.has(`${id}-${i}`)) i++;
        id = `${id}-${i}`;
      }
      usedIds.add(id);
      h.id = id;

      tocItems.push({
        id,
        text: h.textContent || '',
        level: h.tagName === 'H2' ? 2 : 3,
      });
    });

    setItems(tocItems);
  }, []);

  // Track active section on scroll — find the last heading above the viewport top
  // Listens to both window and nearest scrollable ancestor (for modal previews)
  useEffect(() => {
    if (items.length === 0) return;

    const onScroll = () => {
      const offset = 150;
      let current = '';
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top < offset) {
          current = item.id;
        }
      }
      setActiveId(current);
    };

    // Find nearest scrollable ancestor (for modal contexts)
    let scrollParent: Element | null = null;
    let el = navRef.current?.parentElement;
    while (el) {
      const style = getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollParent = el;
        break;
      }
      el = el.parentElement;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    if (scrollParent) {
      scrollParent.addEventListener('scroll', onScroll, { passive: true });
    }
    onScroll(); // set initial state
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', onScroll);
      }
    };
  }, [items]);

  // Auto-scroll the TOC list so the active item stays visible
  useEffect(() => {
    if (!activeId || !tocListRef.current) return;
    const activeEl = tocListRef.current.querySelector('.toc-active') as HTMLElement | null;
    if (!activeEl) return;

    const listRect = tocListRef.current.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    if (activeRect.bottom > listRect.bottom - 10) {
      tocListRef.current.scrollTop += activeRect.bottom - listRect.bottom + 30;
    } else if (activeRect.top < listRect.top + 10) {
      tocListRef.current.scrollTop += activeRect.top - listRect.top - 30;
    }
  }, [activeId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    // Find nearest scrollable ancestor for modal contexts
    let scrollContainer: Element | Window = window;
    let parent = navRef.current?.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainer = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (scrollContainer instanceof Window) {
      const y = target.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      const y = target.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - 100;
      scrollContainer.scrollTo({ top: y, behavior: 'smooth' });
    }
    setActiveId(id);
  }, []);

  if (items.length === 0) return null;

  return (
    <nav className="toc-nav" ref={navRef}>
      <h3>Table of Contents</h3>
      <ul ref={tocListRef}>
        {items.map(item => (
          <li key={item.id} className={`toc-item toc-h${item.level}${activeId === item.id ? ' toc-active' : ''}`}>
            <a href={`#${item.id}`} onClick={e => handleClick(e, item.id)}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
