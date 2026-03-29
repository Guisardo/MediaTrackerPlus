import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MediaTrailer } from 'mediatracker-api';

jest.mock('@lingui/macro', () => {
  const React = require('react');
  return {
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    t: (strings: TemplateStringsArray | string, ...values: unknown[]) => {
      if (typeof strings === 'string') return strings;
      if ((strings as TemplateStringsArray).raw) {
        return String.raw(strings as TemplateStringsArray, ...values);
      }
      return (strings as TemplateStringsArray)[0];
    },
    Plural: ({ value, one, other }: { value: number; one: string; other: string }) =>
      React.createElement(
        React.Fragment,
        null,
        value === 1 ? one : other.replace('#', String(value))
      ),
  };
});

jest.mock('@lingui/react', () => {
  const React = require('react');
  return {
    useLingui: () => ({
      i18n: {
        _: (msg: any) =>
          typeof msg === 'string' ? msg : msg?.message || msg?.id || '',
        locale: 'en',
      },
    }),
    Trans: ({ children, message, id }: any) =>
      React.createElement(React.Fragment, null, children ?? message ?? id ?? null),
    I18nProvider: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('src/components/StarRating', () => ({
  BadgeRating: () => null,
}));

jest.mock('src/components/MetadataLocaleBadge', () => ({
  MetadataLocaleBadge: () => null,
}));

jest.mock('src/components/SelectSeenDate', () => ({
  SelectSeenDate: () => null,
}));

jest.mock('src/components/SetProgress', () => ({
  SetProgressComponent: () => null,
}));

jest.mock('src/components/AddToListModal', () => ({
  AddToListButtonWithModal: () => null,
}));

jest.mock('src/components/AddAndRemoveFromSeenHistoryButton', () => ({
  AddToSeenHistoryButton: () => null,
  RemoveFromSeenHistoryButton: () => null,
}));

jest.mock('src/components/Poster', () => ({
  Poster: () => null,
}));

jest.mock('src/components/date', () => ({
  FormatDuration: () => null,
  RelativeTime: () => null,
}));

jest.mock('src/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button className={className} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('src/components/ui/collapsible', () => ({
  Collapsible: ({ children }: any) => <div>{children}</div>,
  CollapsibleContent: ({ children }: any) => <div>{children}</div>,
  CollapsibleTrigger: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock('src/api/details', () => ({
  useDetails: jest.fn(),
  useUpdateMetadata: jest.fn(),
  addToProgress: jest.fn(),
  addToWatchlist: jest.fn(),
  removeFromWatchlist: jest.fn(),
  markAsSeen: jest.fn(),
}));

jest.mock('src/api/user', () => ({
  useOtherUser: jest.fn(),
  useUser: jest.fn(),
}));

jest.mock('src/api/configuration', () => ({
  useConfiguration: jest.fn(() => ({ configuration: null })),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => ({ mediaItemId: '1' })),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

jest.mock('src/components/Modal', () => {
  const React = require('react');

  return {
    Modal: ({ openModal, children, onBeforeClosed, onClosed }: any) => {
      const [isOpen, setIsOpen] = React.useState(false);

      const closeModal = (arg?: unknown) => {
        onBeforeClosed?.(arg);
        setIsOpen(false);
        onClosed?.(arg);
      };

      return (
        <>
          {openModal?.(() => setIsOpen(true))}
          {isOpen ? <div data-testid="mock-modal">{children(closeModal)}</div> : null}
        </>
      );
    },
  };
});

import { TrailerSection } from 'src/pages/Details';

const trailers: MediaTrailer[] = [
  {
    id: 'youtube:arrival-es',
    title: 'Trailer oficial',
    kind: 'trailer',
    language: 'es',
    isOfficial: true,
    provider: 'tmdb',
    embedUrl: 'https://www.youtube.com/embed/arrival-es',
    externalUrl: 'https://www.youtube.com/watch?v=arrival-es',
  },
  {
    id: 'youtube:arrival-en',
    title: 'Official trailer',
    kind: 'trailer',
    language: 'en',
    isOfficial: true,
    provider: 'tmdb',
    embedUrl: 'https://www.youtube.com/embed/arrival-en',
    externalUrl: 'https://www.youtube.com/watch?v=arrival-en',
  },
];

describe('TrailerSection', () => {
  it('renders nothing when trailers are absent', () => {
    const { container } = render(<TrailerSection trailers={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render an iframe before the user opens the modal', () => {
    render(<TrailerSection trailers={trailers} />);

    expect(screen.getByTestId('open-trailer-modal')).toBeInTheDocument();
    expect(screen.queryByTitle('Trailer oficial')).not.toBeInTheDocument();
  });

  it('opens the modal and renders the primary trailer iframe', () => {
    render(<TrailerSection trailers={trailers} />);

    fireEvent.click(screen.getByTestId('open-trailer-modal'));

    const iframe = screen.getByTitle('Trailer oficial');
    expect(iframe).toHaveAttribute('src', trailers[0].embedUrl);
    expect(screen.getByText(/More options/i)).toBeInTheDocument();
  });

  it('switches to an alternate trailer and tears down the player on close', () => {
    render(<TrailerSection trailers={trailers} />);

    fireEvent.click(screen.getByTestId('open-trailer-modal'));
    fireEvent.click(screen.getByRole('button', { name: 'Official trailer' }));

    const iframe = screen.getByTitle('Official trailer');
    expect(iframe).toHaveAttribute('src', trailers[1].embedUrl);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByTitle('Official trailer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-modal')).not.toBeInTheDocument();
  });
});
