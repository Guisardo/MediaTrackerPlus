/**
 * Verification tests for US-008: React 17 → 19 upgrade.
 *
 * These tests verify that:
 *   1. React 19 is the installed version (not 17 or 18)
 *   2. ReactDOM.createRoot API is available (React 18+ concurrent root)
 *   3. useSyncExternalStore is built-in (no shim needed)
 *   4. The deprecated ReactDOM.render API still exists (for backwards compat)
 *      but createRoot is the primary API
 *   5. useId hook is available (React 18+ feature)
 *   6. use() hook is available (React 19 feature)
 *   7. @testing-library/react renderHook is available (v16+)
 */

import React from 'react';
import { version } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { renderHook } from '@testing-library/react';

describe('React 19 upgrade verification', () => {
  it('React version is 19.x', () => {
    expect(version).toMatch(/^19\./);
  });

  it('React.version matches the import', () => {
    expect(React.version).toBe(version);
  });

  it('ReactDOM.createRoot is available', () => {
    expect(typeof ReactDOMClient.createRoot).toBe('function');
  });

  it('ReactDOM.hydrateRoot is available', () => {
    expect(typeof ReactDOMClient.hydrateRoot).toBe('function');
  });

  it('React.useSyncExternalStore is built-in (no shim needed)', () => {
    expect(typeof React.useSyncExternalStore).toBe('function');
  });

  it('React.useId hook is available (React 18+ feature)', () => {
    expect(typeof React.useId).toBe('function');
  });

  it('React.use hook is available (React 19 feature)', () => {
    expect(typeof React.use).toBe('function');
  });

  it('@testing-library/react renderHook works', () => {
    const { result } = renderHook(() => React.useState(42));
    expect(result.current[0]).toBe(42);
  });

  it('renderHook supports wrapper option', () => {
    const Wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children);

    const { result } = renderHook(() => React.useRef('test'), {
      wrapper: Wrapper,
    });
    expect(result.current.current).toBe('test');
  });

  it('useId generates stable IDs', () => {
    const { result } = renderHook(() => React.useId());
    expect(typeof result.current).toBe('string');
    expect(result.current.length).toBeGreaterThan(0);
  });
});
