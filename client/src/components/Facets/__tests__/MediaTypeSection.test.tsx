import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaTypeSection } from '../MediaTypeSection';

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

jest.mock('src/components/Facets/ExpandableList', () => {
  const React = require('react');
  return {
    ExpandableList: ({ items, children }: any) =>
      React.createElement('div', { 'data-testid': 'expandable-list' }, children(items)),
  };
});

const mockMediaTypes = [
  { value: 'movie', count: 20 },
  { value: 'tv', count: 15 },
  { value: 'book', count: 5 },
];

describe('MediaTypeSection', () => {
  it('renders nothing when mediaType prop is set (single-type page)', () => {
    const { container } = render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
        mediaType: 'movie',
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when mediaTypes array is empty', () => {
    const { container } = render(
      React.createElement(MediaTypeSection, {
        mediaTypes: [],
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders FacetSection with Media Type title on mixed-content pages', () => {
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Media Type');
  });

  it('renders checkboxes with human-readable labels', () => {
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
      })
    );
    expect(screen.getByLabelText('Movie')).toBeInTheDocument();
    expect(screen.getByLabelText('TV Show')).toBeInTheDocument();
    expect(screen.getByLabelText('Book')).toBeInTheDocument();
  });

  it('marks pre-selected media types as checked', () => {
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: ['movie'],
        setMediaTypes: jest.fn(),
      })
    );
    const movieCheckbox = screen.getByLabelText('Movie') as HTMLInputElement;
    expect(movieCheckbox.checked).toBe(true);
    const tvCheckbox = screen.getByLabelText('TV Show') as HTMLInputElement;
    expect(tvCheckbox.checked).toBe(false);
  });

  it('calls setMediaTypes with value added when unchecked checkbox is toggled', () => {
    const setMediaTypes = jest.fn();
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: [],
        setMediaTypes,
      })
    );
    fireEvent.click(screen.getByLabelText('Movie'));
    expect(setMediaTypes).toHaveBeenCalledWith(['movie']);
  });

  it('calls setMediaTypes with value removed when checked checkbox is toggled', () => {
    const setMediaTypes = jest.fn();
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: ['movie', 'tv'],
        setMediaTypes,
      })
    );
    fireEvent.click(screen.getByLabelText('Movie'));
    expect(setMediaTypes).toHaveBeenCalledWith(['tv']);
  });

  it('shows item counts for each media type', () => {
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: mockMediaTypes,
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
      })
    );
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders "Video game" label for video_game value', () => {
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: [{ value: 'video_game', count: 8 }],
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
      })
    );
    expect(screen.getByLabelText('Video game')).toBeInTheDocument();
  });

  it('renders "Audiobook" label for audiobook value', () => {
    render(
      React.createElement(MediaTypeSection, {
        mediaTypes: [{ value: 'audiobook', count: 3 }],
        selectedMediaTypes: [],
        setMediaTypes: jest.fn(),
      })
    );
    expect(screen.getByLabelText('Audiobook')).toBeInTheDocument();
  });
});
