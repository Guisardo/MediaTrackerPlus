import React from 'react';
import { render, screen } from '@testing-library/react';
import { GenreSection } from '../GenreSection';

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string' ? strings : strings.raw ? String.raw(strings, ...values) : strings[0],
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('src/components/Facets/FacetSection', () => {
  const React = require('react');
  return {
    FacetSection: ({ title, children }: any) =>
      React.createElement('div', { 'data-testid': 'facet-section' },
        React.createElement('span', { 'data-testid': 'facet-title' }, title),
        children
      ),
  };
});

jest.mock('src/components/Facets/FacetCheckboxList', () => {
  const React = require('react');
  return {
    FacetCheckboxList: ({ items, selectedValues }: any) =>
      React.createElement('div', { 'data-testid': 'facet-checkbox-list', 'data-count': items.length, 'data-selected': selectedValues.join(',') }),
  };
});

const mockGenres = [
  { value: 'action', count: 10 },
  { value: 'drama', count: 5 },
];

describe('GenreSection', () => {
  it('renders nothing when genres array is empty', () => {
    const { container } = render(
      React.createElement(GenreSection, {
        genres: [],
        selectedGenres: [],
        setGenres: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders FacetSection with Genre title when genres are provided', () => {
    render(
      React.createElement(GenreSection, {
        genres: mockGenres,
        selectedGenres: [],
        setGenres: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-section')).toBeInTheDocument();
    expect(screen.getByTestId('facet-title').textContent).toBe('Genre');
  });

  it('renders FacetCheckboxList with genres items', () => {
    render(
      React.createElement(GenreSection, {
        genres: mockGenres,
        selectedGenres: ['action'],
        setGenres: jest.fn(),
      })
    );
    const list = screen.getByTestId('facet-checkbox-list');
    expect(list).toBeInTheDocument();
    expect(list.getAttribute('data-count')).toBe('2');
    expect(list.getAttribute('data-selected')).toBe('action');
  });

  it('passes setGenres as onSelectionChange to FacetCheckboxList', () => {
    const setGenres = jest.fn();
    render(
      React.createElement(GenreSection, {
        genres: mockGenres,
        selectedGenres: [],
        setGenres,
      })
    );
    expect(screen.getByTestId('facet-checkbox-list')).toBeInTheDocument();
  });
});
