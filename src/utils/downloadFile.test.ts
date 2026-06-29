import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFile } from './downloadFile';

afterEach(() => vi.restoreAllMocks());

describe('downloadFile', () => {
  it('creates an anchor with the href/filename, clicks it, and cleans up', () => {
    const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string) => (tag === 'a' ? anchor : origCreate(tag)),
    );
    const append = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    const remove = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    downloadFile('/docs/pluto-f-datasheet.pdf', 'NineScrolls-PLUTO-F-Datasheet.pdf');

    expect(anchor.href).toBe('/docs/pluto-f-datasheet.pdf');
    expect(anchor.download).toBe('NineScrolls-PLUTO-F-Datasheet.pdf');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith(anchor);
    expect(remove).toHaveBeenCalledWith(anchor);
  });
});
