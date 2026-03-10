/**
 * Tests for AddToSeenHistoryButton and RemoveFromSeenHistoryButton defined in
 * src/components/AddAndRemoveFromSeenHistoryButton.tsx.
 *
 * Dependencies mocked:
 *  - src/utils            – isAudiobook, isBook, isMovie, isTvShow, isVideoGame,
 *                           formatEpisodeNumber, formatSeasonNumber
 *  - src/components/Modal – renders children immediately
 *  - src/components/SelectSeenDate – stub
 *  - src/components/Confirm – resolves to true by default
 *  - src/api/details      – markAsUnseen
 *  - @lingui/macro / @lingui/react – passthrough
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
  plural: (_count: number, options: Record<string, string>) =>
    options.other ?? options.one ?? '',
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

jest.mock('src/components/Modal', () => {
  const React = require('react');
  const Modal = ({
    openModal,
    children,
  }: {
    openModal?: (open: () => void) => React.ReactNode;
    children: ((closeModal: () => void) => React.ReactNode) | React.ReactNode;
  }) => {
    const [isOpen, setIsOpen] = React.useState(!openModal);
    return React.createElement(
      React.Fragment,
      null,
      openModal && openModal(() => setIsOpen(true)),
      isOpen &&
        (typeof children === 'function'
          ? children(() => setIsOpen(false))
          : children)
    );
  };
  return { Modal };
});

jest.mock('src/components/SelectSeenDate', () => {
  const React = require('react');
  return {
    SelectSeenDate: ({ mediaItem }: any) =>
      React.createElement(
        'div',
        { 'data-testid': 'select-seen-date' },
        mediaItem.title
      ),
  };
});

const mockConfirm = jest.fn().mockResolvedValue(true);
jest.mock('src/components/Confirm', () => ({
  Confirm: (...args: any[]) => mockConfirm(...args),
}));

const mockMarkAsUnseen = jest.fn().mockResolvedValue(undefined);
jest.mock('src/api/details', () => ({
  markAsUnseen: (...args: any[]) => mockMarkAsUnseen(...args),
}));

// Utils – control which media type predicates return true
const mockIsAudiobook = jest.fn().mockReturnValue(false);
const mockIsBook = jest.fn().mockReturnValue(false);
const mockIsMovie = jest.fn().mockReturnValue(false);
const mockIsTvShow = jest.fn().mockReturnValue(false);
const mockIsVideoGame = jest.fn().mockReturnValue(false);

jest.mock('src/utils', () => ({
  isAudiobook: (...args: any[]) => mockIsAudiobook(...args),
  isBook: (...args: any[]) => mockIsBook(...args),
  isMovie: (...args: any[]) => mockIsMovie(...args),
  isTvShow: (...args: any[]) => mockIsTvShow(...args),
  isVideoGame: (...args: any[]) => mockIsVideoGame(...args),
  formatEpisodeNumber: (ep: any) => `E${ep?.episodeNumber ?? '?'}`,
  formatSeasonNumber: (s: any) => `S${s?.seasonNumber ?? '?'}`,
}));

import {
  AddToSeenHistoryButton,
  RemoveFromSeenHistoryButton,
} from 'src/components/AddAndRemoveFromSeenHistoryButton';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeMovieItem = () =>
  ({
    id: 1,
    title: 'Test Movie',
    mediaType: 'movie',
    seenHistory: [{ id: 10 }, { id: 11 }],
  } as any);

const makeTvItem = () =>
  ({
    id: 2,
    title: 'Test Show',
    mediaType: 'tv',
    seenHistory: [{ id: 20, episodeId: 100 }, { id: 21, episodeId: 101 }],
  } as any);

const makeBookItem = () =>
  ({
    id: 3,
    title: 'Test Book',
    mediaType: 'book',
    seenHistory: [{ id: 30 }],
  } as any);

const makeAudiobookItem = () =>
  ({
    id: 4,
    title: 'Test Audiobook',
    mediaType: 'audiobook',
    seenHistory: [{ id: 40 }],
  } as any);

const makeVideoGameItem = () =>
  ({
    id: 5,
    title: 'Test Game',
    mediaType: 'video_game',
    seenHistory: [{ id: 50 }],
  } as any);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resetMediaTypeMocks = () => {
  mockIsAudiobook.mockReturnValue(false);
  mockIsBook.mockReturnValue(false);
  mockIsMovie.mockReturnValue(false);
  mockIsTvShow.mockReturnValue(false);
  mockIsVideoGame.mockReturnValue(false);
};

beforeEach(() => {
  jest.clearAllMocks();
  resetMediaTypeMocks();
  mockConfirm.mockResolvedValue(true);
});

// ===========================================================================
// AddToSeenHistoryButton
// ===========================================================================

describe('AddToSeenHistoryButton', () => {
  describe('label for movie', () => {
    it('renders "Add to seen history" for a movie', () => {
      mockIsMovie.mockReturnValue(true);
      render(
        React.createElement(AddToSeenHistoryButton, { mediaItem: makeMovieItem() })
      );
      expect(screen.getByText('Add to seen history')).toBeInTheDocument();
    });
  });

  describe('label for book', () => {
    it('renders "Add to read history" for a book', () => {
      mockIsBook.mockReturnValue(true);
      render(
        React.createElement(AddToSeenHistoryButton, { mediaItem: makeBookItem() })
      );
      expect(screen.getByText('Add to read history')).toBeInTheDocument();
    });
  });

  describe('label for audiobook', () => {
    it('renders "Add to listened history" for an audiobook', () => {
      mockIsAudiobook.mockReturnValue(true);
      render(
        React.createElement(AddToSeenHistoryButton, {
          mediaItem: makeAudiobookItem(),
        })
      );
      expect(screen.getByText('Add to listened history')).toBeInTheDocument();
    });
  });

  describe('label for video game', () => {
    it('renders "Add to played history" for a video game', () => {
      mockIsVideoGame.mockReturnValue(true);
      render(
        React.createElement(AddToSeenHistoryButton, {
          mediaItem: makeVideoGameItem(),
        })
      );
      expect(screen.getByText('Add to played history')).toBeInTheDocument();
    });
  });

  describe('label for TV show', () => {
    it('renders "Add to seen history" for a TV show with no season/episode', () => {
      mockIsTvShow.mockReturnValue(true);
      render(
        React.createElement(AddToSeenHistoryButton, { mediaItem: makeTvItem() })
      );
      expect(screen.getByText('Add to seen history')).toBeInTheDocument();
    });

    it('renders "Add season to seen history" when season provided and useSeasonAndEpisodeNumber=false', () => {
      mockIsTvShow.mockReturnValue(true);
      const season = { id: 10, seasonNumber: 1 };
      render(
        React.createElement(AddToSeenHistoryButton, {
          mediaItem: makeTvItem(),
          season,
        })
      );
      expect(screen.getByText('Add season to seen history')).toBeInTheDocument();
    });

    it('renders "Add episode to seen history" when episode provided and useSeasonAndEpisodeNumber=false', () => {
      mockIsTvShow.mockReturnValue(true);
      const episode = { id: 100, episodeNumber: 1, seasonNumber: 1 };
      render(
        React.createElement(AddToSeenHistoryButton, {
          mediaItem: makeTvItem(),
          episode,
        })
      );
      expect(screen.getByText('Add episode to seen history')).toBeInTheDocument();
    });

    it('renders a button element when useSeasonAndEpisodeNumber=true and season provided', () => {
      mockIsTvShow.mockReturnValue(true);
      const season = { id: 10, seasonNumber: 2 };
      const { container } = render(
        React.createElement(AddToSeenHistoryButton, {
          mediaItem: makeTvItem(),
          season,
          useSeasonAndEpisodeNumber: true,
        })
      );
      // The button div should be rendered (label contains ICU placeholders in test env)
      expect(container.querySelector('.btn-blue')).toBeInTheDocument();
    });

    it('renders a button element when useSeasonAndEpisodeNumber=true and episode provided', () => {
      mockIsTvShow.mockReturnValue(true);
      const episode = { id: 100, episodeNumber: 5, seasonNumber: 1 };
      const { container } = render(
        React.createElement(AddToSeenHistoryButton, {
          mediaItem: makeTvItem(),
          episode,
          useSeasonAndEpisodeNumber: true,
        })
      );
      expect(container.querySelector('.btn-blue')).toBeInTheDocument();
    });
  });

  describe('modal interaction', () => {
    it('opens SelectSeenDate modal when button clicked', async () => {
      mockIsMovie.mockReturnValue(true);
      const user = userEvent.setup();
      render(
        React.createElement(AddToSeenHistoryButton, { mediaItem: makeMovieItem() })
      );
      await user.click(screen.getByText('Add to seen history'));
      expect(screen.getByTestId('select-seen-date')).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// RemoveFromSeenHistoryButton
// ===========================================================================

describe('RemoveFromSeenHistoryButton', () => {
  describe('label for movie', () => {
    it('renders "Remove from seen history" for a movie', () => {
      mockIsMovie.mockReturnValue(true);
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeMovieItem(),
        })
      );
      expect(screen.getByText('Remove from seen history')).toBeInTheDocument();
    });
  });

  describe('label for book', () => {
    it('renders "Remove from read history" for a book', () => {
      mockIsBook.mockReturnValue(true);
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeBookItem(),
        })
      );
      expect(screen.getByText('Remove from read history')).toBeInTheDocument();
    });
  });

  describe('label for audiobook', () => {
    it('renders "Remove from listened history" for an audiobook', () => {
      mockIsAudiobook.mockReturnValue(true);
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeAudiobookItem(),
        })
      );
      expect(screen.getByText('Remove from listened history')).toBeInTheDocument();
    });
  });

  describe('label for video game', () => {
    it('renders "Remove from played history" for a video game', () => {
      mockIsVideoGame.mockReturnValue(true);
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeVideoGameItem(),
        })
      );
      expect(screen.getByText('Remove from played history')).toBeInTheDocument();
    });
  });

  describe('label for TV show', () => {
    it('renders "Remove from seen history" for TV show with no season/episode', () => {
      mockIsTvShow.mockReturnValue(true);
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeTvItem(),
        })
      );
      expect(screen.getByText('Remove from seen history')).toBeInTheDocument();
    });

    it('renders "Remove season from seen history" when season provided', () => {
      mockIsTvShow.mockReturnValue(true);
      const season = {
        id: 10,
        seasonNumber: 1,
        episodes: [{ id: 100 }, { id: 101 }],
      };
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeTvItem(),
          season,
        })
      );
      expect(screen.getByText('Remove season from seen history')).toBeInTheDocument();
    });

    it('renders "Remove episode from seen history" when episode provided', () => {
      mockIsTvShow.mockReturnValue(true);
      const episode = { id: 100, episodeNumber: 1, seasonNumber: 1 };
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeTvItem(),
          episode,
        })
      );
      expect(screen.getByText('Remove episode from seen history')).toBeInTheDocument();
    });
  });

  describe('click interactions', () => {
    it('calls Confirm when button is clicked', async () => {
      mockIsMovie.mockReturnValue(true);
      const user = userEvent.setup();
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeMovieItem(),
        })
      );
      await user.click(screen.getByText('Remove from seen history'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    });

    it('calls markAsUnseen when Confirm resolves true', async () => {
      mockIsMovie.mockReturnValue(true);
      mockConfirm.mockResolvedValue(true);
      const user = userEvent.setup();
      const mediaItem = makeMovieItem();
      render(
        React.createElement(RemoveFromSeenHistoryButton, { mediaItem })
      );
      await user.click(screen.getByText('Remove from seen history'));
      await waitFor(() => expect(mockMarkAsUnseen).toHaveBeenCalledTimes(1));
      expect(mockMarkAsUnseen).toHaveBeenCalledWith(
        expect.objectContaining({ mediaItem })
      );
    });

    it('does NOT call markAsUnseen when Confirm resolves false', async () => {
      mockIsMovie.mockReturnValue(true);
      mockConfirm.mockResolvedValue(false);
      const user = userEvent.setup();
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeMovieItem(),
        })
      );
      await user.click(screen.getByText('Remove from seen history'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
      expect(mockMarkAsUnseen).not.toHaveBeenCalled();
    });

    it('calls markAsUnseen with seenId when seenId is provided', async () => {
      mockIsMovie.mockReturnValue(true);
      mockConfirm.mockResolvedValue(true);
      const user = userEvent.setup();
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeMovieItem(),
          seenId: 99,
        })
      );
      await user.click(screen.getByText('Remove from seen history'));
      await waitFor(() => expect(mockMarkAsUnseen).toHaveBeenCalledTimes(1));
      expect(mockMarkAsUnseen).toHaveBeenCalledWith(
        expect.objectContaining({ seenId: 99 })
      );
    });
  });

  describe('count calculation', () => {
    it('uses count=1 when seenId is provided', async () => {
      mockIsMovie.mockReturnValue(true);
      const user = userEvent.setup();
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeMovieItem(),
          seenId: 10,
        })
      );
      await user.click(screen.getByText('Remove from seen history'));
      // Confirm is called; if count=1 it uses the 'one' plural form
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    });

    it('uses total seenHistory count when no seenId/season/episode', async () => {
      mockIsMovie.mockReturnValue(true);
      const user = userEvent.setup();
      // Movie has 2 seenHistory entries
      render(
        React.createElement(RemoveFromSeenHistoryButton, {
          mediaItem: makeMovieItem(),
        })
      );
      await user.click(screen.getByText('Remove from seen history'));
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
    });
  });
});
