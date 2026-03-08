/**
 * Tests for the date utility components defined in src/components/date.tsx:
 *  - RelativeTime: formats a Date relative to now using date-fns formatDistance
 *  - FormatDuration: formats a millisecond duration using date-fns formatDuration
 *
 * Both components depend on `useLingui` from @lingui/react to determine the
 * locale for date-fns.  The hook is mocked to always return { i18n: { locale: 'en' } }
 * so tests are locale-deterministic.
 */

import React from 'react';
import { render } from '@testing-library/react';
import {
  formatDistance,
  formatDuration,
  intervalToDuration,
} from 'date-fns';
import { enUS } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Mock @lingui/react so useLingui returns an English locale
// ---------------------------------------------------------------------------
jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    i18n: { locale: 'en' },
  }),
}));

// ---------------------------------------------------------------------------
// Also mock date-fns/locale so we can supply 'en' via the module
// (the component does `locale[lingui.i18n.locale]` which resolves to undefined
// if the locale key isn't exported; we re-export en as 'en' for tests)
// ---------------------------------------------------------------------------
jest.mock('date-fns/locale', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const actual = jest.requireActual('date-fns/locale');
  // date-fns/locale does not export a key named 'en'; it uses 'enUS'.
  // The component accesses `locale['en']` so we provide that mapping.
  return {
    __esModule: true,
    ...actual,
    en: actual.enUS,
  };
});

import { RelativeTime, FormatDuration } from '../date';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the expected output that date-fns would produce for the given Date
 * relative to the current time.  Because the component computes `new Date()`
 * internally, we compute the expected value immediately before rendering and
 * accept a small tolerance window (the test runs within ms).
 */
const expectedRelativeTime = (to: Date): string =>
  formatDistance(to, new Date(), { locale: enUS, addSuffix: true });

const expectedDuration = (milliseconds: number): string =>
  formatDuration(
    intervalToDuration({ start: 0, end: milliseconds }),
    { delimiter: ', ', locale: enUS }
  );

// ---------------------------------------------------------------------------
// RelativeTime
// ---------------------------------------------------------------------------

describe('RelativeTime', () => {
  it('renders a relative time string for a date in the past', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    const { container } = render(<RelativeTime to={twoDaysAgo} />);

    const expected = expectedRelativeTime(twoDaysAgo);
    // The component renders bare text inside a Fragment; use container.textContent
    expect(container.textContent).toBe(expected);
  });

  it('renders a relative time string for a date in the future', () => {
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const { container } = render(<RelativeTime to={inThreeDays} />);

    const expected = expectedRelativeTime(inThreeDays);
    // The component renders bare text inside a Fragment; use container.textContent
    expect(container.textContent).toBe(expected);
  });

  it('renders a relative time string for a date seconds in the past', () => {
    const justNow = new Date(Date.now() - 30 * 1000);

    const { container } = render(<RelativeTime to={justNow} />);

    // date-fns v2+ formats sub-minute differences as "less than a minute ago" in en.
    // Verify the component renders a non-empty relative time string.
    const expected = expectedRelativeTime(justNow);
    expect(container.textContent).toBe(expected);
  });

  it('renders "about 1 year ago" for a date approximately one year in the past', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const { container } = render(<RelativeTime to={oneYearAgo} />);

    // The component renders text in a Fragment; use container.textContent
    expect(container.textContent).toMatch(/about 1 year ago/i);
  });

  it('renders inside a React Fragment (no wrapping element)', () => {
    const date = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    const { container } = render(<RelativeTime to={date} />);

    // The component renders text directly inside a Fragment. RTL wraps in a
    // <div>, so there are no element children — only a text node.
    expect(container.children).toHaveLength(0);
    // But textContent should be non-empty (the formatted relative time string)
    expect(container.textContent).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// FormatDuration
// ---------------------------------------------------------------------------

describe('FormatDuration', () => {
  it('renders zero duration as an empty string', () => {
    // formatDuration returns '' for a zero-length interval
    const { container } = render(<FormatDuration milliseconds={0} />);
    expect(container.textContent).toBe('');
  });

  it('renders duration in minutes for a value under one hour', () => {
    const thirtyMinutes = 30 * 60 * 1000;

    const { container } = render(<FormatDuration milliseconds={thirtyMinutes} />);

    const expected = expectedDuration(thirtyMinutes);
    expect(container.textContent).toBe(expected);
  });

  it('renders duration in hours and minutes for a value over one hour', () => {
    const ninetyMinutes = 90 * 60 * 1000;

    const { container } = render(<FormatDuration milliseconds={ninetyMinutes} />);

    const expected = expectedDuration(ninetyMinutes);
    expect(container.textContent).toBe(expected);
  });

  it('renders a two-hour duration correctly', () => {
    const twoHours = 2 * 60 * 60 * 1000;

    const { container } = render(<FormatDuration milliseconds={twoHours} />);

    const expected = expectedDuration(twoHours);
    expect(container.textContent).toBe(expected);
  });

  it('renders a complex duration containing days and hours', () => {
    const twoDaysThreeHours =
      (2 * 24 * 60 * 60 + 3 * 60 * 60) * 1000;

    const { container } = render(<FormatDuration milliseconds={twoDaysThreeHours} />);

    const expected = expectedDuration(twoDaysThreeHours);
    expect(container.textContent).toBe(expected);
  });

  it('uses a comma delimiter between duration parts', () => {
    // 1 hour 30 minutes → "1 hour, 30 minutes"
    const oneHourThirtyMin = (1 * 60 * 60 + 30 * 60) * 1000;

    const { container } = render(<FormatDuration milliseconds={oneHourThirtyMin} />);

    const expected = expectedDuration(oneHourThirtyMin);
    // The delimiter in the component is ', '
    expect(expected).toContain(', ');
    expect(container.textContent).toBe(expected);
  });
});
