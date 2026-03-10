import React from 'react';
import { render, screen } from '@testing-library/react';
import { CreatorSection } from '../CreatorSection';

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
    FacetCheckboxList: ({ items }: any) =>
      React.createElement('div', { 'data-testid': 'facet-checkbox-list', 'data-count': items.length }),
  };
});

const mockCreators = [
  { value: 'Christopher Nolan', count: 5 },
  { value: 'Denis Villeneuve', count: 3 },
];

describe('CreatorSection', () => {
  it('renders nothing when creators array is empty', () => {
    const { container } = render(
      React.createElement(CreatorSection, {
        creators: [],
        selectedCreators: [],
        setCreators: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Director" title for movie mediaType', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
        mediaType: 'movie',
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Director');
  });

  it('renders "Creator" title for tv mediaType', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
        mediaType: 'tv',
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Creator');
  });

  it('renders "Author" title for book mediaType', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
        mediaType: 'book',
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Author');
  });

  it('renders "Author" title for audiobook mediaType', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
        mediaType: 'audiobook',
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Author');
  });

  it('renders "Developer" title for video_game mediaType', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
        mediaType: 'video_game',
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Developer');
  });

  it('renders generic "Creator" title for mixed-content (no mediaType)', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Creator');
  });

  it('passes creators items to FacetCheckboxList', () => {
    render(
      React.createElement(CreatorSection, {
        creators: mockCreators,
        selectedCreators: [],
        setCreators: jest.fn(),
        mediaType: 'movie',
      })
    );
    expect(screen.getByTestId('facet-checkbox-list').getAttribute('data-count')).toBe('2');
  });
});
