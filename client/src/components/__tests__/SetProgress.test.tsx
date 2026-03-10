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
  Plural: ({ value, one, other }: { value: number | string; one: string; other: string }) =>
    value === 1 ? one : other,
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

const mockAddToProgress = jest.fn().mockResolvedValue(undefined);
jest.mock('src/api/details', () => ({
  addToProgress: (...args: any[]) => mockAddToProgress(...args),
}));

jest.mock('src/utils', () => ({
  isBook: (item: any) => {
    const mt = item?.mediaType ?? item;
    return mt === 'book';
  },
  isAudiobook: (item: any) => {
    const mt = item?.mediaType ?? item;
    return mt === 'audiobook';
  },
  isMovie: (item: any) => {
    const mt = item?.mediaType ?? item;
    return mt === 'movie';
  },
  isVideoGame: (item: any) => {
    const mt = item?.mediaType ?? item;
    return mt === 'video_game';
  },
  isTvShow: (item: any) => {
    const mt = item?.mediaType ?? item;
    return mt === 'tv';
  },
}));

import { SetProgressComponent } from '../SetProgress';

const createMediaItem = (overrides: Record<string, any> = {}) => ({
  id: 1,
  title: 'Test Item',
  mediaType: 'movie' as const,
  progress: 0,
  ...overrides,
});

describe('SetProgressComponent', () => {
  it('renders the title and buttons', () => {
    const closeModal = jest.fn();
    render(
      <SetProgressComponent
        mediaItem={createMediaItem() as any}
        closeModal={closeModal}
      />
    );
    expect(screen.getByText('Set progress')).toBeInTheDocument();
    expect(screen.getByText('Set')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls closeModal when Cancel is clicked', () => {
    const closeModal = jest.fn();
    render(
      <SetProgressComponent
        mediaItem={createMediaItem() as any}
        closeModal={closeModal}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('renders the range slider with initial progress', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ progress: 0.5 }) as any}
        closeModal={jest.fn()}
      />
    );
    const rangeInput = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(rangeInput).toBeInTheDocument();
    expect(rangeInput.value).toBe('50');
  });

  it('updates progress when range slider changes', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem() as any}
        closeModal={jest.fn()}
      />
    );
    const rangeInput = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(rangeInput, { target: { value: '75' } });
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('renders InputComponent for books with numberOfPages', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'book', numberOfPages: 300 }) as any}
        closeModal={jest.fn()}
      />
    );
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('page');
  });

  it('renders InputComponent for movies with runtime', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'movie', runtime: 120 }) as any}
        closeModal={jest.fn()}
      />
    );
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain('minute');
  });

  it('renders InputComponent for audiobooks with runtime', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'audiobook', runtime: 600 }) as any}
        closeModal={jest.fn()}
      />
    );
    expect(container.textContent).toContain('minute');
  });

  it('renders duration input for video games', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'video_game' }) as any}
        closeModal={jest.fn()}
      />
    );
    // Duration is rendered via Trans macro
    expect(container.textContent).toContain('Duration');
  });

  it('renders duration input for books', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'book', numberOfPages: 200 }) as any}
        closeModal={jest.fn()}
      />
    );
    expect(container.textContent).toContain('Duration');
  });

  it('does not render duration input for movies', () => {
    render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'movie' }) as any}
        closeModal={jest.fn()}
      />
    );
    expect(screen.queryByText('Duration')).not.toBeInTheDocument();
  });

  it('submits form and calls addToProgress', () => {
    const closeModal = jest.fn();
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ id: 42 }) as any}
        closeModal={closeModal}
      />
    );
    const form = container.querySelector('form');
    fireEvent.submit(form!);
    expect(mockAddToProgress).toHaveBeenCalledWith({
      mediaItemId: 42,
      progress: 0,
      duration: 0,
    });
    expect(closeModal).toHaveBeenCalled();
  });

  it('handles number input change for book pages', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'book', numberOfPages: 100 }) as any}
        closeModal={jest.fn()}
      />
    );
    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: '50' } });
    expect(numberInput.value).toBe('50');
  });

  it('handles empty string input in number field', () => {
    const { container } = render(
      <SetProgressComponent
        mediaItem={createMediaItem({ mediaType: 'book', numberOfPages: 100 }) as any}
        closeModal={jest.fn()}
      />
    );
    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: '' } });
    expect(numberInput.value).toBe('');
  });
});
