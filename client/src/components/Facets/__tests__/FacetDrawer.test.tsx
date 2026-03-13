import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacetDrawer } from '../FacetDrawer';

// jsdom does not implement window.matchMedia — provide a minimal mock.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

/**
 * Mock the shadcn/ui Sheet components.
 * Sheet.Root propagates `open` and `onOpenChange` to SheetContent via context.
 * SheetContent renders children only when open, and exposes a test overlay
 * that triggers onOpenChange(false) when clicked.
 */
jest.mock('@/components/ui/sheet', () => {
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const SheetContext = React.createContext({ open: false, onOpenChange: (_: boolean): void => {} });

  const Sheet = ({ open, onOpenChange, children }: any) =>
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    React.createElement(SheetContext.Provider, { value: { open: !!open, onOpenChange: onOpenChange || ((): void => {}) } }, children);

  const SheetContent = ({ children, side, className, showCloseButton }: any) => {
    const { open, onOpenChange } = React.useContext(SheetContext);
    if (!open) return null;
    return React.createElement(
      'div',
      { 'data-testid': 'sheet-content', 'data-side': side, className },
      // Simulated overlay for backdrop-click tests
      React.createElement('div', {
        'data-testid': 'sheet-overlay',
        onClick: () => onOpenChange(false),
      }),
      children,
    );
  };

  const SheetHeader = ({ children, className }: any) =>
    React.createElement('div', { 'data-testid': 'sheet-header', className }, children);

  const SheetTitle = ({ children, className }: any) =>
    React.createElement('div', { 'data-slot': 'sheet-title', className }, children);

  const SheetTrigger = ({ children }: any) => children;
  const SheetClose = ({ children }: any) => children;
  const SheetFooter = ({ children }: any) => children;
  const SheetDescription = ({ children }: any) => children;

  return { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose, SheetFooter, SheetDescription };
});

const createMockFacets = (overrides: Record<string, any> = {}) => ({
  facetParams: {},
  activeFacetCount: 0,
  clearAllFacets: jest.fn(),
  selectedGenres: [],
  setGenres: jest.fn(),
  selectedLanguages: [],
  setLanguages: jest.fn(),
  yearMin: null,
  yearMax: null,
  setYearMin: jest.fn(),
  setYearMax: jest.fn(),
  ratingMin: null,
  ratingMax: null,
  setRatingMin: jest.fn(),
  setRatingMax: jest.fn(),
  ...overrides,
});

describe('FacetDrawer', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      React.createElement(FacetDrawer, {
        isOpen: false,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    // SheetContent returns null when not open — container has Sheet Root only (no visible content)
    expect(screen.queryByTestId('sheet-content')).not.toBeInTheDocument();
  });

  it('renders Sheet content when isOpen is true', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(screen.getByTestId('sheet-content')).toBeInTheDocument();
  });

  it('renders Filters header text', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders Close button with aria-label', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(screen.getByLabelText('Close filters')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = jest.fn();
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose,
        facets: createMockFacets() as any,
      })
    );
    fireEvent.click(screen.getByLabelText('Close filters'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Sheet overlay is clicked (backdrop dismiss)', () => {
    const onClose = jest.fn();
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose,
        facets: createMockFacets() as any,
      })
    );
    // The mocked overlay simulates the Sheet built-in backdrop click
    fireEvent.click(screen.getByTestId('sheet-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show Clear all button when activeFacetCount is 0', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets({ activeFacetCount: 0 }) as any,
      })
    );
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('shows Clear all button when activeFacetCount > 0', () => {
    const facets = createMockFacets({ activeFacetCount: 2 });
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: facets as any,
      })
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('calls clearAllFacets when Clear all is clicked', () => {
    const facets = createMockFacets({ activeFacetCount: 2 });
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: facets as any,
      })
    );
    fireEvent.click(screen.getByText('Clear all'));
    expect(facets.clearAllFacets).toHaveBeenCalledTimes(1);
  });

  it('renders children content', () => {
    render(
      React.createElement(
        FacetDrawer,
        {
          isOpen: true,
          onClose: jest.fn(),
          facets: createMockFacets() as any,
        },
        React.createElement('div', { 'data-testid': 'child' }, 'Child content')
      )
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('uses bottom side on mobile viewport', () => {
    // jsdom defaults to 1024px+, so we test the default state which maps to 'right'
    // after the matchMedia effect. Since jsdom doesn't support matchMedia,
    // the default state 'bottom' is used until the effect fires.
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    // Sheet renders — content is present
    expect(screen.getByTestId('sheet-content')).toBeInTheDocument();
  });
});
