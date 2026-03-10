import React from 'react';
import { render, screen } from '@testing-library/react';
import { PublisherSection } from '../PublisherSection';

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

const mockPublishers = [
  { value: 'Nintendo', count: 12 },
  { value: 'Sony', count: 8 },
];

describe('PublisherSection', () => {
  it('renders nothing when publishers array is empty', () => {
    const { container } = render(
      React.createElement(PublisherSection, {
        publishers: [],
        selectedPublishers: [],
        setPublishers: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mediaType is set and is not video_game', () => {
    const { container } = render(
      React.createElement(PublisherSection, {
        publishers: mockPublishers,
        selectedPublishers: [],
        setPublishers: jest.fn(),
        mediaType: 'movie',
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mediaType is book', () => {
    const { container } = render(
      React.createElement(PublisherSection, {
        publishers: mockPublishers,
        selectedPublishers: [],
        setPublishers: jest.fn(),
        mediaType: 'book',
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders FacetSection with Publisher title for video_game mediaType', () => {
    render(
      React.createElement(PublisherSection, {
        publishers: mockPublishers,
        selectedPublishers: [],
        setPublishers: jest.fn(),
        mediaType: 'video_game',
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Publisher');
    expect(screen.getByTestId('facet-checkbox-list')).toBeInTheDocument();
  });

  it('renders on mixed-content pages (no mediaType) when publishers exist', () => {
    render(
      React.createElement(PublisherSection, {
        publishers: mockPublishers,
        selectedPublishers: [],
        setPublishers: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Publisher');
  });

  it('passes publishers items to FacetCheckboxList', () => {
    render(
      React.createElement(PublisherSection, {
        publishers: mockPublishers,
        selectedPublishers: [],
        setPublishers: jest.fn(),
        mediaType: 'video_game',
      })
    );
    expect(screen.getByTestId('facet-checkbox-list').getAttribute('data-count')).toBe('2');
  });
});
