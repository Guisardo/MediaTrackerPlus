import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@lingui/core', () => ({
  i18n: {
    _: (d: any) => (typeof d === 'string' ? d : d?.message ?? d?.id ?? String(d)),
    activate: jest.fn(),
    on: jest.fn(),
  },
  setupI18n: () => ({
    _: (d: any) => (typeof d === 'string' ? d : d?.message ?? d?.id ?? String(d)),
    activate: jest.fn(),
    on: jest.fn(),
  }),
}));

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: { children?: React.ReactNode; message?: string; id?: string }) =>
    children ?? message ?? id ?? null,
}));

const mockSetLastSeenEpisode = jest.fn().mockResolvedValue(undefined);

jest.mock('src/api/details', () => ({
  useDetails: jest.fn(),
  setLastSeenEpisode: (...args: any[]) => mockSetLastSeenEpisode(...args),
}));

jest.mock('src/components/Modal', () => {
  const React = require('react');
  return {
    Modal: ({ openModal, children, onBeforeClosed }: any) => {
      const [open, setOpen] = React.useState(false);
      return React.createElement(
        'div',
        { 'data-testid': 'modal-wrapper' },
        openModal(() => setOpen(true)),
        open
          ? React.createElement(
              'div',
              { 'data-testid': 'modal-content' },
              children(() => {
                setOpen(false);
                onBeforeClosed?.();
              })
            )
          : null
      );
    },
  };
});

jest.mock('src/components/SelectSeenDate', () => {
  const React = require('react');
  return {
    SelectSeenDateComponent: ({ mediaItem, closeModal, onSelected }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'select-seen-date' },
        React.createElement('button', {
          'data-testid': 'select-now',
          onClick: () => onSelected({ date: new Date() }),
        }, 'Now')
      ),
  };
});

jest.mock('src/utils', () => ({
  formatSeasonNumber: (season: any) => `S${String(season.seasonNumber).padStart(2, '0')}`,
}));

import { useDetails } from 'src/api/details';
import { SelectLastSeenEpisode } from '../SelectLastSeenEpisode';

const mockUseDetails = useDetails as jest.Mock;

const createTvShow = (overrides: Record<string, any> = {}) => ({
  id: 1,
  title: 'Breaking Bad',
  mediaType: 'tv' as const,
  progress: 0,
  seasons: [
    {
      id: 10,
      seasonNumber: 1,
      title: 'Season 1',
      isSpecialSeason: false,
      episodes: [
        { id: 101, episodeNumber: 1, title: 'Pilot', seasonNumber: 1 },
        { id: 102, episodeNumber: 2, title: 'Cat in the Bag', seasonNumber: 1 },
      ],
    },
    {
      id: 20,
      seasonNumber: 2,
      title: 'Season 2',
      isSpecialSeason: false,
      episodes: [
        { id: 201, episodeNumber: 1, title: 'Seven Thirty-Seven', seasonNumber: 2 },
        { id: 202, episodeNumber: 2, title: 'Grilled', seasonNumber: 2 },
      ],
    },
  ],
  ...overrides,
});

describe('SelectLastSeenEpisode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state when data is loading', () => {
    mockUseDetails.mockReturnValue({ mediaItem: undefined, isLoading: true });
    render(
      <SelectLastSeenEpisode
        tvShow={createTvShow() as any}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders season and episode selectors when loaded without season prop', () => {
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    const { container } = render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    expect(container.textContent).toContain('Season');
    expect(container.textContent).toContain('Episode');
  });

  it('does not render season selector when season prop is provided', () => {
    const tvShow = createTvShow();
    const season = tvShow.seasons[0];
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        season={season as any}
        closeModal={jest.fn()}
      />
    );
    // The season select should not be shown when season prop is provided
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(1); // only episode select
  });

  it('renders Cancel button that calls closeModal', () => {
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    const closeModal = jest.fn();
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={closeModal}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('renders Select button', () => {
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  it('renders episode options in the episode selector', () => {
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    const { container } = render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    // The last season (Season 2) is pre-selected via useEffect, episodes should appear
    const options = container.querySelectorAll('option');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('Seven Thirty-Seven'))).toBe(true);
  });

  it('changes season selection', () => {
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    const { container } = render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    const selects = screen.getAllByRole('combobox');
    const seasonSelect = selects[0];
    fireEvent.change(seasonSelect, { target: { value: '10' } });
    // After changing to Season 1, its episodes should render as options
    const options = container.querySelectorAll('option');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('Pilot'))).toBe(true);
  });

  it('filters out special seasons from season dropdown', () => {
    const tvShow = createTvShow({
      seasons: [
        {
          id: 99,
          seasonNumber: 0,
          title: 'Specials',
          isSpecialSeason: true,
          episodes: [{ id: 991, episodeNumber: 1, title: 'Behind the Scenes', seasonNumber: 0 }],
        },
        {
          id: 10,
          seasonNumber: 1,
          title: 'Season 1',
          isSpecialSeason: false,
          episodes: [{ id: 101, episodeNumber: 1, title: 'Pilot', seasonNumber: 1 }],
        },
      ],
    });
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).not.toContain('Specials');
    expect(optionTexts).toContain('Season 1');
  });

  it('opens modal and shows SelectSeenDateComponent when Select is clicked', () => {
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('Select'));
    expect(screen.getByTestId('select-seen-date')).toBeInTheDocument();
  });
});
