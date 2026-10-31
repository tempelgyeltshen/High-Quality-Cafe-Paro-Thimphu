import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  if (typeof window !== 'undefined') {
    cleanup();
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
});

// Polyfill DOM methods not implemented in jsdom
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
  window.print = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();

  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  }
}
