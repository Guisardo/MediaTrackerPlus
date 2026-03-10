import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacetDrawer } from '../FacetDrawer';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

jest.mock('src/components/Portal', () => {
  const React = require('react');
  return {
    Portal: ({ children }: any) =>
      React.createElement('div', { 'data-testid': 'portal' }, children),
  };
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
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      React.createElement(FacetDrawer, {
        isOpen: false,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders portal with dialog when isOpen is true', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(screen.getByTestId('portal')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
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

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose,
        facets: createMockFacets() as any,
      })
    );
    // The backdrop is the first child of the portal (aria-hidden div)
    const portal = screen.getByTestId('portal');
    const backdrop = portal.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop!);
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

  it('sets body overflow to hidden when open', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when closed', () => {
    const { rerender } = render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      React.createElement(FacetDrawer, {
        isOpen: false,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      })
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn();
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose,
        facets: createMockFacets() as any,
      })
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders children content', () => {
    render(
      React.createElement(FacetDrawer, {
        isOpen: true,
        onClose: jest.fn(),
        facets: createMockFacets() as any,
      },
        React.createElement('div', { 'data-testid': 'child' }, 'Child content')
      )
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
