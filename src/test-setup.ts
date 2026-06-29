import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom does not implement these scroll APIs. Components may call them from
// async callbacks (e.g. a setTimeout in ContactPage) after a test completes,
// which would otherwise throw an unhandled TypeError and pollute the run.
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();

afterEach(() => {
  cleanup();
});
