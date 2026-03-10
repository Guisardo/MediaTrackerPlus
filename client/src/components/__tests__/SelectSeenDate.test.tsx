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

jest.mock('date-fns/format', () => ({
  __esModule: true,
  default: (d: Date, fmt: string) => d.toISOString().slice(0, 10),
}));

const mockMarkAsSeen = jest.fn().mockResolvedValue(undefined);
jest.mock('src/api/details', () => ({
  markAsSeen: (...args: any[]) => mockMarkAsSeen(...args),
}));

jest.mock('src/components/SelectLastSeenEpisode', () => {
  const React = require('react');
  return {
    SelectLastSeenEpisode: ({ tvShow, closeModal }: any) =>
      React.createElement('div', { 'data-testid': 'select-last-seen-episode' }, tvShow?.title),
  };
});

jest.mock('src/utils', () => ({
  isBook: (item: any) => (item?.mediaType ?? item) === 'book',
  isAudiobook: (item: any) => (item?.mediaType ?? item) === 'audiobook',
  isMovie: (item: any) => (item?.mediaType ?? item) === 'movie',
  isTvShow: (item: any) => (item?.mediaType ?? item) === 'tv',
  isVideoGame: (item: any) => (item?.mediaType ?? item) === 'video_game',
  formatEpisodeNumber: (ep: any) => `S${String(ep.seasonNumber).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')}`,
}));

import { SelectSeenDate, SelectSeenDateComponent } from '../SelectSeenDate';

const createMediaItem = (overrides: Record<string, any> = {}) => ({
  id: 1,
  title: 'Test Movie',
  mediaType: 'movie' as const,
  progress: 0,
  ...overrides,
});

describe('SelectSeenDate', () => {
  it('renders SelectLastSeenEpisode when mediaType is tv and no episode', () => {
    render(
      <SelectSeenDate
        mediaItem={createMediaItem({ mediaType: 'tv', title: 'Breaking Bad' }) as any}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByTestId('select-last-seen-episode')).toBeInTheDocument();
    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
  });

  it('renders SelectSeenDateComponent when episode is provided for tv', () => {
    const episode = { id: 1, seasonNumber: 1, episodeNumber: 1, title: 'Pilot' };
    render(
      <SelectSeenDate
        mediaItem={createMediaItem({ mediaType: 'tv', title: 'Breaking Bad' }) as any}
        episode={episode as any}
        closeModal={jest.fn()}
      />
    );
    expect(screen.queryByTestId('select-last-seen-episode')).not.toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('renders SelectSeenDateComponent for non-tv media', () => {
    render(
      <SelectSeenDate
        mediaItem={createMediaItem({ mediaType: 'movie', title: 'Inception' }) as any}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByText('At release date')).toBeInTheDocument();
    expect(screen.getByText('I do not remember')).toBeInTheDocument();
  });
});

describe('SelectSeenDateComponent', () => {
  it('renders date prompt for movie', () => {
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem({ title: 'Inception' }) as any}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('renders date prompt for book', () => {
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem({ mediaType: 'book', title: 'Dune' }) as any}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('renders date prompt for audiobook', () => {
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem({ mediaType: 'audiobook', title: 'Sapiens' }) as any}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('renders date prompt for video game', () => {
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem({ mediaType: 'video_game', title: 'Zelda' }) as any}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('renders episode info for tv show with episode', () => {
    const episode = { id: 1, seasonNumber: 2, episodeNumber: 5, title: 'Ozymandias' };
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem({ mediaType: 'tv', title: 'Breaking Bad' }) as any}
        episode={episode as any}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
      />
    );
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('calls onSelected with date when Now is clicked', () => {
    const onSelected = jest.fn();
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem() as any}
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('Now'));
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected.mock.calls[0][0]).toHaveProperty('date');
  });

  it('calls onSelected with release_date when At release date is clicked', () => {
    const onSelected = jest.fn();
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem() as any}
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('At release date'));
    expect(onSelected).toHaveBeenCalledWith({ seenAt: 'release_date' });
  });

  it('calls onSelected with unknown when I do not remember is clicked', () => {
    const onSelected = jest.fn();
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem() as any}
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('I do not remember'));
    expect(onSelected).toHaveBeenCalledWith({ seenAt: 'unknown' });
  });

  it('calls closeModal when Cancel is clicked', () => {
    const closeModal = jest.fn();
    render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem() as any}
        onSelected={jest.fn()}
        closeModal={closeModal}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('renders date and time inputs', () => {
    const { container } = render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem() as any}
        onSelected={jest.fn()}
        closeModal={jest.fn()}
      />
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="time"]')).toBeInTheDocument();
  });

  it('submits custom date form', () => {
    const onSelected = jest.fn();
    const { container } = render(
      <SelectSeenDateComponent
        mediaItem={createMediaItem() as any}
        onSelected={onSelected}
        closeModal={jest.fn()}
      />
    );
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = container.querySelector('input[type="time"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-06-15' } });
    fireEvent.change(timeInput, { target: { value: '14:30' } });
    const form = container.querySelector('form');
    fireEvent.submit(form!);
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected.mock.calls[0][0]).toHaveProperty('date');
  });
});
