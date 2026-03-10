/**
 * Tests for StatisticsGenreSegment defined in
 * src/components/Statistics/StatisticsGenreSegment.tsx.
 *
 * Dependencies mocked:
 *  - @lingui/macro      – Trans / t passthrough
 *  - @lingui/react      – Trans / useLingui passthrough
 *  - react-router-dom   – MemoryRouter + mock navigate
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockI18nTranslate = (descriptor: any): string => {
  if (typeof descriptor === 'string') return descriptor;
  return descriptor?.message ?? descriptor?.id ?? String(descriptor);
};

jest.mock('@lingui/core', () => ({
  i18n: {
    _: (descriptor: any) => mockI18nTranslate(descriptor),
    t: (descriptor: any) => mockI18nTranslate(descriptor),
    activate: jest.fn(),
    on: jest.fn(),
  },
  setupI18n: () => ({
    _: (descriptor: any) => mockI18nTranslate(descriptor),
    activate: jest.fn(),
    on: jest.fn(),
  }),
}));

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
  useLingui: () => ({
    i18n: {
      _: (descriptor: any) => mockI18nTranslate(descriptor),
    },
  }),
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

import StatisticsGenreSegment from 'src/components/Statistics/StatisticsGenreSegment';

const renderComponent = (data: any, year?: string) =>
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(StatisticsGenreSegment, { data, year })
    )
  );

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('StatisticsGenreSegment', () => {
  it('renders nothing when data is undefined', () => {
    renderComponent(undefined, '2023');
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
    expect(screen.queryByText('Games')).not.toBeInTheDocument();
  });

  it('renders nothing when data is null', () => {
    renderComponent(null, '2023');
    expect(screen.queryByText('Tv')).not.toBeInTheDocument();
    expect(screen.queryByText('Movies')).not.toBeInTheDocument();
    expect(screen.queryByText('Games')).not.toBeInTheDocument();
  });

  it('renders one section block when data.tv is present', () => {
    const { container } = renderComponent(
      { tv: [{ genre: 'Action', count: 5 }] },
      '2023'
    );
    expect(container.querySelectorAll('.mb-6').length).toBe(1);
  });

  it('renders one section block when data.movie is present', () => {
    const { container } = renderComponent(
      { movie: [{ genre: 'Drama', count: 3 }] },
      '2023'
    );
    expect(container.querySelectorAll('.mb-6').length).toBe(1);
  });

  it('renders one section block when data.video_game is present', () => {
    const { container } = renderComponent(
      { video_game: [{ genre: 'RPG', count: 7 }] },
      '2023'
    );
    expect(container.querySelectorAll('.mb-6').length).toBe(1);
  });

  it('renders genre items as clickable rows', () => {
    const { container } = renderComponent(
      { tv: [{ genre: 'Action', count: 5 }, { genre: 'Comedy', count: 2 }] },
      '2023'
    );
    const clickableRows = container.querySelectorAll('.hover\\:underline');
    expect(clickableRows.length).toBe(2);
  });

  it('navigates to tv genre path when a genre row is clicked', () => {
    const { container } = renderComponent(
      { tv: [{ genre: 'Action', count: 5 }] },
      '2023'
    );
    const clickableRow = container.querySelector('.hover\\:underline');
    fireEvent.click(clickableRow);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/genre/tv/' })
    );
    const callArg = mockNavigate.mock.calls[0][0];
    expect(callArg.search).toContain('genre=Action');
    expect(callArg.search).toContain('year=2023');
  });

  it('navigates to movie genre path when a movie genre row is clicked', () => {
    const { container } = renderComponent(
      { movie: [{ genre: 'Drama', count: 3 }] },
      '2022'
    );
    const clickableRow = container.querySelector('.hover\\:underline');
    fireEvent.click(clickableRow);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/genre/movie/' })
    );
  });

  it('navigates to video_game genre path when a game genre row is clicked', () => {
    const { container } = renderComponent(
      { video_game: [{ genre: 'RPG', count: 7 }] },
      '2021'
    );
    const clickableRow = container.querySelector('.hover\\:underline');
    fireEvent.click(clickableRow);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/statistics/genre/video_game/' })
    );
  });

  it('does NOT render any section when data.tv is absent and only movie provided', () => {
    const { container } = renderComponent(
      { movie: [{ genre: 'Drama', count: 3 }] },
      '2023'
    );
    // Only one section for movie, no tv section
    expect(container.querySelectorAll('.mb-6').length).toBe(1);
  });

  it('renders three section blocks when data has tv, movie, and video_game', () => {
    const { container } = renderComponent(
      {
        tv: [{ genre: 'Action', count: 5 }],
        movie: [{ genre: 'Drama', count: 3 }],
        video_game: [{ genre: 'RPG', count: 7 }],
      },
      '2023'
    );
    expect(container.querySelectorAll('.mb-6').length).toBe(3);
  });
});
