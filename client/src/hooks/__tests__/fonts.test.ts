/**
 * Tests for src/hooks/fonts.ts – useFonts hook.
 *
 * Covers:
 *   - loaded starts as false
 *   - loaded becomes true after document.fonts.ready resolves
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import { useFonts } from 'src/hooks/fonts';

// ---------------------------------------------------------------------------
// renderHook polyfill (same as mediaItem.test.ts)
// ---------------------------------------------------------------------------

function renderHook<T>(callback: () => T): {
  result: { current: T };
  rerender: () => void;
} {
  const result = { current: undefined as unknown as T };
  const container = document.createElement('div');
  document.body.appendChild(container);
  function TestComponent() {
    result.current = callback();
    return null;
  }
  act(() => {
    ReactDOM.render(React.createElement(TestComponent), container);
  });
  return {
    result,
    rerender: () => {
      act(() => {
        ReactDOM.render(React.createElement(TestComponent), container);
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFonts', () => {
  it('returns loaded=false initially before fonts are ready', () => {
    // Make document.fonts.ready never resolve during this test
    const originalFonts = document.fonts;
    Object.defineProperty(document, 'fonts', {
      value: { ready: new Promise(() => {}) }, // never resolves
      configurable: true,
    });

    const { result } = renderHook(() => useFonts());

    expect(result.current.loaded).toBe(false);

    Object.defineProperty(document, 'fonts', {
      value: originalFonts,
      configurable: true,
    });
  });

  it('returns loaded=true after document.fonts.ready resolves', async () => {
    let resolveReady: () => void;
    const readyPromise = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    Object.defineProperty(document, 'fonts', {
      value: { ready: readyPromise },
      configurable: true,
    });

    const result = { current: { loaded: false } };
    const container = document.createElement('div');
    document.body.appendChild(container);

    function TestComponent() {
      result.current = useFonts();
      return null;
    }

    act(() => {
      ReactDOM.render(React.createElement(TestComponent), container);
    });

    expect(result.current.loaded).toBe(false);

    await act(async () => {
      resolveReady!();
      await readyPromise;
    });

    expect(result.current.loaded).toBe(true);

    Object.defineProperty(document, 'fonts', {
      value: { ready: Promise.resolve() },
      configurable: true,
    });
  });
});
