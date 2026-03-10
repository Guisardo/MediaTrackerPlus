import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusSection } from '../StatusSection';

jest.mock('@lingui/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string' ? strings : strings.raw ? String.raw(strings, ...values) : strings[0],
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));
jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: any) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

jest.mock('src/utils', () => ({
  isAudiobook: (v: string) => v === 'audiobook',
  isBook: (v: string) => v === 'book',
  isVideoGame: (v: string) => v === 'video_game',
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

describe('StatusSection', () => {
  it('renders FacetSection with Status title', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus: jest.fn(),
      })
    );
    expect(screen.getByTestId('facet-title').textContent).toBe('Status');
  });

  it('renders all four status checkboxes', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus: jest.fn(),
      })
    );
    expect(screen.getByLabelText('Rated')).toBeInTheDocument();
    expect(screen.getByLabelText('Unrated')).toBeInTheDocument();
    expect(screen.getByLabelText('On watchlist')).toBeInTheDocument();
    expect(screen.getByLabelText('Watched')).toBeInTheDocument();
  });

  it('shows "Played" label for video_game media type', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus: jest.fn(),
        mediaType: 'video_game',
      })
    );
    expect(screen.getByLabelText('Played')).toBeInTheDocument();
  });

  it('shows "Read" label for book media type', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus: jest.fn(),
        mediaType: 'book',
      })
    );
    expect(screen.getByLabelText('Read')).toBeInTheDocument();
  });

  it('shows "Listened" label for audiobook media type', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus: jest.fn(),
        mediaType: 'audiobook',
      })
    );
    expect(screen.getByLabelText('Listened')).toBeInTheDocument();
  });

  it('marks pre-selected status as checked', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: ['rated'],
        setStatus: jest.fn(),
      })
    );
    const ratedCheckbox = screen.getByLabelText('Rated') as HTMLInputElement;
    expect(ratedCheckbox.checked).toBe(true);
    const unratedCheckbox = screen.getByLabelText('Unrated') as HTMLInputElement;
    expect(unratedCheckbox.checked).toBe(false);
  });

  it('calls setStatus with added key when unchecked checkbox is toggled', () => {
    const setStatus = jest.fn();
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus,
      })
    );
    fireEvent.click(screen.getByLabelText('Rated'));
    expect(setStatus).toHaveBeenCalledWith(['rated']);
  });

  it('calls setStatus with key removed when checked checkbox is toggled', () => {
    const setStatus = jest.fn();
    render(
      React.createElement(StatusSection, {
        selectedStatus: ['rated', 'watchlist'],
        setStatus,
      })
    );
    fireEvent.click(screen.getByLabelText('Rated'));
    expect(setStatus).toHaveBeenCalledWith(['watchlist']);
  });

  it('shows "match all" hint when statuses are selected', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: ['rated'],
        setStatus: jest.fn(),
      })
    );
    expect(screen.getByText('Item must match all selected statuses')).toBeInTheDocument();
  });

  it('does not show "match all" hint when no statuses selected', () => {
    render(
      React.createElement(StatusSection, {
        selectedStatus: [],
        setStatus: jest.fn(),
      })
    );
    expect(screen.queryByText('Item must match all selected statuses')).not.toBeInTheDocument();
  });
});
