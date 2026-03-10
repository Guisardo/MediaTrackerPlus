import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FacetPanel } from '../FacetPanel';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

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

describe('FacetPanel', () => {
  it('renders an aside with aria-label Filters', () => {
    const facets = createMockFacets();
    render(React.createElement(FacetPanel, { facets: facets as any }));
    expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument();
  });

  it('does not show header row when activeFacetCount is 0', () => {
    const facets = createMockFacets({ activeFacetCount: 0 });
    render(React.createElement(FacetPanel, { facets: facets as any }));
    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });

  it('shows Filters label and Clear all filters button when facets are active', () => {
    const facets = createMockFacets({ activeFacetCount: 3 });
    render(React.createElement(FacetPanel, { facets: facets as any }));
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('calls clearAllFacets when Clear all filters button is clicked', () => {
    const facets = createMockFacets({ activeFacetCount: 2 });
    render(React.createElement(FacetPanel, { facets: facets as any }));
    fireEvent.click(screen.getByText('Clear all filters'));
    expect(facets.clearAllFacets).toHaveBeenCalledTimes(1);
  });

  it('renders children content', () => {
    const facets = createMockFacets();
    render(
      React.createElement(FacetPanel, { facets: facets as any },
        React.createElement('div', { 'data-testid': 'child-content' }, 'Hello')
      )
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
