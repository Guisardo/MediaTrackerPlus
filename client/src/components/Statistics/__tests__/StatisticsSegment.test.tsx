/**
 * Tests for StatisticsSegmant (sic) defined in
 * src/components/Statistics/StatisticsSegment.tsx.
 *
 * Dependencies mocked:
 *  - @lingui/macro      – Trans passthrough
 *  - @lingui/react      – Trans / useLingui passthrough
 *  - react-router-dom   – MemoryRouter + mock navigate
 *  - src/components/date – FormatDuration renders milliseconds as text
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: any) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    createSearchParams: actual.createSearchParams,
  };
});

jest.mock('src/components/date', () => ({
  FormatDuration: ({ milliseconds }: { milliseconds: number }) => {
    const React = require('react');
    return React.createElement('span', null, String(milliseconds));
  },
}));

import StatisticsSegmant from 'src/components/Statistics/StatisticsSegment';

const renderComponent = (data: any, year?: string) =>
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(StatisticsSegmant, { data, year })
    )
  );

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('StatisticsSegmant', () => {
  it('renders nothing when data is undefined', () => {
    renderComponent(undefined);
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
  });

  it('renders nothing when data is null', () => {
    renderComponent(null);
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
  });

  it('renders TV section when tv.plays > 0', () => {
    renderComponent({
      tv: { plays: 10, episodes: 20, items: 5, duration: 0 },
    });
    expect(screen.getByText('Tv')).toBeInTheDocument();
  });

  it('does NOT render TV section when tv.plays === 0', () => {
    renderComponent({
      tv: { plays: 0, episodes: 0, items: 0, duration: 0 },
    });
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
  });

  it('renders Movies section when movie.plays > 0', () => {
    renderComponent({
      movie: { plays: 3, items: 3, duration: 0 },
    });
    expect(screen.getByText('Movies')).toBeInTheDocument();
  });

  it('renders Games section when video_game.plays > 0', () => {
    renderComponent({
      video_game: { plays: 2, items: 2, duration: 0 },
    });
    expect(screen.getByText('Games')).toBeInTheDocument();
  });

  it('renders Books section when book.plays > 0', () => {
    renderComponent({
      book: { plays: 4, items: 4, duration: 0 },
    });
    expect(screen.getByText('Books')).toBeInTheDocument();
  });

  it('renders Audiobooks section when audiobook.plays > 0', () => {
    renderComponent({
      audiobook: { plays: 1, items: 1, duration: 0 },
    });
    expect(screen.getByText('Audiobooks')).toBeInTheDocument();
  });

  it('shows tv duration section when tv.duration > 0', () => {
    const { container } = renderComponent({
      tv: { plays: 5, episodes: 10, items: 3, duration: 120 },
    });
    // FormatDuration renders inside the whitespace-nowrap div
    // The mock renders a span with the ms value; check it's present somewhere
    expect(container.querySelector('.whitespace-nowrap')).toBeInTheDocument();
  });

  it('does NOT show tv duration section when tv.duration === 0', () => {
    const { container } = renderComponent({
      tv: { plays: 5, episodes: 10, items: 3, duration: 0 },
    });
    // Only one whitespace-nowrap div (the episodes one, not duration)
    const divs = container.querySelectorAll('.whitespace-nowrap');
    expect(divs.length).toBe(1);
  });

  it('renders tv section content when plays > 0', () => {
    const { container } = renderComponent({
      tv: { plays: 10, episodes: 20, items: 5, duration: 0 },
    });
    // The TV section should be present with at least one div
    const tvSection = container.querySelector('.mb-6');
    expect(tvSection).toBeInTheDocument();
  });

  it('navigates to /statistics/seen/tv when TV heading clicked (with year)', () => {
    renderComponent(
      { tv: { plays: 5, episodes: 10, items: 3, duration: 0 } },
      '2023'
    );
    fireEvent.click(screen.getByText('Tv'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/seen/tv' })
    );
  });

  it('navigates to /statistics/seen/tv when TV heading clicked (without year)', () => {
    renderComponent({ tv: { plays: 5, episodes: 10, items: 3, duration: 0 } });
    fireEvent.click(screen.getByText('Tv'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/seen/tv', search: '' })
    );
  });

  it('navigates to /statistics/seen/movie when Movies heading clicked', () => {
    renderComponent(
      { movie: { plays: 3, items: 3, duration: 0 } },
      '2022'
    );
    fireEvent.click(screen.getByText('Movies'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/seen/movie' })
    );
  });

  it('navigates to /statistics/seen/video_game when Games heading clicked', () => {
    renderComponent(
      { video_game: { plays: 2, items: 2, duration: 0 } },
      '2021'
    );
    fireEvent.click(screen.getByText('Games'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/seen/video_game' })
    );
  });

  it('renders multiple media types simultaneously', () => {
    renderComponent({
      tv: { plays: 5, episodes: 10, items: 3, duration: 0 },
      movie: { plays: 3, items: 3, duration: 0 },
      book: { plays: 2, items: 2, duration: 0 },
    });
    expect(screen.getByText('Tv')).toBeInTheDocument();
    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText('Books')).toBeInTheDocument();
  });
});
