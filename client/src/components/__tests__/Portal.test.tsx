/**
 * Tests for src/components/Portal.tsx
 */

import React from 'react';
import { render } from '@testing-library/react';

import { Portal } from 'src/components/Portal';

beforeEach(() => {
  // Ensure #portal element exists for the Portal component
  let portalEl = document.getElementById('portal');
  if (!portalEl) {
    portalEl = document.createElement('div');
    portalEl.id = 'portal';
    document.body.appendChild(portalEl);
  }
});

afterEach(() => {
  const portalEl = document.getElementById('portal');
  if (portalEl) {
    portalEl.innerHTML = '';
  }
});

describe('Portal', () => {
  it('renders children into the #portal element (not inline)', () => {
    const { container } = render(
      React.createElement(
        'div',
        { id: 'app-root' },
        React.createElement(Portal, null, React.createElement('span', { id: 'portal-child' }, 'Portal Content'))
      )
    );

    // Child should appear in #portal, not in the app-root container
    const portalEl = document.getElementById('portal');
    expect(portalEl!.querySelector('#portal-child')).not.toBeNull();
    expect(container.querySelector('#portal-child')).toBeNull();
  });

  it('renders text content of children into the portal', () => {
    render(
      React.createElement(
        Portal,
        null,
        React.createElement('p', { id: 'portal-text' }, 'Hello from portal')
      )
    );

    const portalEl = document.getElementById('portal');
    expect(portalEl!.textContent).toContain('Hello from portal');
  });

  it('removes children from the portal on unmount', () => {
    const { unmount } = render(
      React.createElement(
        Portal,
        null,
        React.createElement('span', { id: 'unmount-test' }, 'temp')
      )
    );

    const portalEl = document.getElementById('portal');
    expect(portalEl!.querySelector('#unmount-test')).not.toBeNull();

    unmount();

    expect(portalEl!.querySelector('#unmount-test')).toBeNull();
  });
});
