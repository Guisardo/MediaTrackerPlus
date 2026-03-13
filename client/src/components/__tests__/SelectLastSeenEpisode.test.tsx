import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Mock radix-ui Select primitives to render a native <select> in jsdom.
 * Radix UI Select relies on pointer events and portals that don't work in jsdom.
 * This mock renders a native select/option so tests can interact with them simply.
 */
jest.mock('radix-ui', () => {
  const React = require('react');

  const Root = ({ children, value, onValueChange, defaultValue }: any) => {
    const [internalValue, setInternalValue] = React.useState(value ?? defaultValue ?? '');

    React.useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);

    const handleChange = (newVal: string) => {
      setInternalValue(newVal);
      onValueChange?.(newVal);
    };

    return (
      <div data-radix-select-root>
        {React.Children.map(children, (child: React.ReactElement) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child, { __value: internalValue, __onChange: handleChange } as any);
        })}
      </div>
    );
  };

  const Trigger = React.forwardRef(({ children, 'aria-label': ariaLabel, __value, __onChange, ...props }: any, ref: any) => (
    <button ref={ref} role="combobox" aria-label={ariaLabel} {...props}>{children}</button>
  ));

  const Value = ({ placeholder, __value }: any) => <span>{__value || placeholder || ''}</span>;

  const Icon = ({ children }: any) => <>{children}</>;

  const Portal = ({ children }: any) => <>{children}</>;

  const Content = ({ children, __value, __onChange, ...props }: any) => (
    <div>
      {React.Children.map(children, (child: React.ReactElement) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { __value, __onChange } as any);
      })}
    </div>
  );

  const Viewport = ({ children, __value, __onChange }: any) => (
    <div>
      {React.Children.map(children, (child: React.ReactElement) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { __value, __onChange } as any);
      })}
    </div>
  );

  const Item = React.forwardRef(({ children, value, __value, __onChange, ...props }: any, ref: any) => (
    <div
      ref={ref}
      role="option"
      aria-selected={__value === value}
      data-value={value}
      onClick={() => __onChange?.(value)}
      {...props}
    >
      <ItemText>{children}</ItemText>
    </div>
  ));

  const ItemText = ({ children }: any) => <span>{children}</span>;

  const ItemIndicator = ({ children }: any) => <>{children}</>;

  const ScrollUpButton = ({ children }: any) => <>{children}</>;
  const ScrollDownButton = ({ children }: any) => <>{children}</>;

  const Group = ({ children, __value, __onChange }: any) => (
    <div>
      {React.Children.map(children, (child: React.ReactElement) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child, { __value, __onChange } as any);
      })}
    </div>
  );

  const Label = ({ children }: any) => <div>{children}</div>;
  const Separator = () => <hr />;

  return {
    Select: {
      Root,
      Trigger,
      Value,
      Icon,
      Portal,
      Content,
      Viewport,
      Item,
      ItemText,
      ItemIndicator,
      ScrollUpButton,
      ScrollDownButton,
      Group,
      Label,
      Separator,
    },
  };
});

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
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    // With the radix-ui mock, options render directly in the DOM as role="option"
    // The last season (Season 2) is pre-selected via useEffect, episodes should appear
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('Seven Thirty-Seven'))).toBe(true);
  });

  it('changes season selection', async () => {
    const user = userEvent.setup();
    const tvShow = createTvShow();
    mockUseDetails.mockReturnValue({ mediaItem: tvShow, isLoading: false });
    render(
      <SelectLastSeenEpisode
        tvShow={tvShow as any}
        closeModal={jest.fn()}
      />
    );
    // Click Season 1 option directly (radix mock renders all options in DOM)
    const season1Option = screen.getByRole('option', { name: 'Season 1' });
    await user.click(season1Option);

    // After clicking Season 1, its episodes should render as options
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts.some((t) => t?.includes('Pilot'))).toBe(true);
    });
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
    // With radix mock, all options are rendered in the DOM
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts.every((t) => t !== 'Specials')).toBe(true);
    expect(optionTexts.some((t) => t?.includes('Season 1'))).toBe(true);
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
