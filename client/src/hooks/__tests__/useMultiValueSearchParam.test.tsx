/**
 * Tests for src/hooks/useMultiValueSearchParam.ts
 *
 * Covers:
 *   - Returns empty array when param is absent
 *   - Parses CSV string to an array of trimmed, non-empty strings
 *   - Writing a non-empty array sets a comma-joined URL param
 *   - Writing an empty array removes the param
 *   - Writing resets the page param
 *   - onchange callback is called on every write
 *   - Preserves other URL params (e.g. orderBy) on write
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { useMultiValueSearchParam } from 'src/hooks/useMultiValueSearchParam';

// ---------------------------------------------------------------------------
// Test harness that drives the hook and exposes state via DOM
// ---------------------------------------------------------------------------

interface HarnessProps {
  paramName: string;
  onchange?: jest.Mock;
  newValues?: string[];
}

const HookHarness: React.FC<HarnessProps> = ({ paramName, onchange, newValues }) => {
  const { values, setValues } = useMultiValueSearchParam(paramName, onchange);

  return (
    <>
      <span data-testid="values">{JSON.stringify(values)}</span>
      {newValues !== undefined && (
        <button onClick={() => setValues(newValues)}>Set Values</button>
      )}
    </>
  );
};

const renderHarness = (props: HarnessProps, initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HookHarness {...props} />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Reading values
// ---------------------------------------------------------------------------

describe('useMultiValueSearchParam – reading values', () => {
  it('returns an empty array when the param is absent from the URL', () => {
    renderHarness({ paramName: 'genres' }, '/items');

    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([]);
  });

  it('parses a CSV string into an array of values', () => {
    renderHarness({ paramName: 'genres' }, '/items?genres=Action,Drama');

    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([
      'Action',
      'Drama',
    ]);
  });

  it('trims whitespace from each parsed value', () => {
    renderHarness({ paramName: 'genres' }, '/items?genres=Action%2C+Drama');

    const values = JSON.parse(screen.getByTestId('values').textContent!);
    expect(values).toContain('Action');
    expect(values).toContain('Drama');
    expect(values.every((v: string) => v === v.trim())).toBe(true);
  });

  it('filters out empty strings produced by consecutive commas', () => {
    // URL-encoded "Action,,Drama" after splitting gives ['Action', '', 'Drama']
    renderHarness(
      { paramName: 'genres' },
      '/items?genres=Action%2C%2CDrama'
    );

    const values = JSON.parse(screen.getByTestId('values').textContent!);
    expect(values).not.toContain('');
    expect(values).toContain('Action');
    expect(values).toContain('Drama');
  });

  it('returns a single-element array for a single-value param', () => {
    renderHarness({ paramName: 'genres' }, '/items?genres=Action');

    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([
      'Action',
    ]);
  });

  it('returns an empty array when the param value is an empty string', () => {
    renderHarness({ paramName: 'genres' }, '/items?genres=');

    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Writing values
// ---------------------------------------------------------------------------

describe('useMultiValueSearchParam – writing values (setValues)', () => {
  it('sets a comma-joined URL param when writing a non-empty array', async () => {
    const user = userEvent.setup();
    renderHarness(
      { paramName: 'genres', newValues: ['Action', 'Drama'] },
      '/items'
    );

    await user.click(screen.getByRole('button', { name: 'Set Values' }));

    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([
      'Action',
      'Drama',
    ]);
  });

  it('removes the param from the URL when writing an empty array', async () => {
    const user = userEvent.setup();
    renderHarness(
      { paramName: 'genres', newValues: [] },
      '/items?genres=Action,Drama'
    );

    await user.click(screen.getByRole('button', { name: 'Set Values' }));

    expect(JSON.parse(screen.getByTestId('values').textContent!)).toEqual([]);
  });

  it('calls the onchange callback when values are set', async () => {
    const onchange = jest.fn();
    const user = userEvent.setup();
    renderHarness(
      { paramName: 'genres', onchange, newValues: ['Action'] },
      '/items'
    );

    await user.click(screen.getByRole('button', { name: 'Set Values' }));

    expect(onchange).toHaveBeenCalledTimes(1);
  });

  it('calls the onchange callback when values are cleared (empty array)', async () => {
    const onchange = jest.fn();
    const user = userEvent.setup();
    renderHarness(
      { paramName: 'genres', onchange, newValues: [] },
      '/items?genres=Action'
    );

    await user.click(screen.getByRole('button', { name: 'Set Values' }));

    expect(onchange).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onchange when no onchange is provided', async () => {
    const user = userEvent.setup();
    // This test just ensures no error is thrown when onchange is undefined
    renderHarness(
      { paramName: 'genres', newValues: ['Action'] },
      '/items'
    );

    await expect(
      user.click(screen.getByRole('button', { name: 'Set Values' }))
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Page reset behaviour
// ---------------------------------------------------------------------------

describe('useMultiValueSearchParam – page reset', () => {
  /**
   * Renders two hook instances in the same MemoryRouter tree so we can
   * verify the page param is dropped when the genre param is updated.
   */
  const TwoParamHarness: React.FC<{
    paramName: string;
    newValues: string[];
  }> = ({ paramName, newValues }) => {
    const { values, setValues } = useMultiValueSearchParam(paramName);
    const { values: pageValues } = useMultiValueSearchParam('page');

    return (
      <>
        <span data-testid="param-values">{JSON.stringify(values)}</span>
        <span data-testid="page-values">{JSON.stringify(pageValues)}</span>
        <button onClick={() => setValues(newValues)}>Set Values</button>
      </>
    );
  };

  it('removes the page param when writing new values', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/items?genres=Comedy&page=3']}>
        <TwoParamHarness paramName="genres" newValues={['Action']} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Set Values' }));

    // After writing, the page param should have been removed
    expect(
      JSON.parse(screen.getByTestId('page-values').textContent!)
    ).toEqual([]);
  });

  it('preserves orderBy param when writing new values', async () => {
    const user = userEvent.setup();

    const WithOrderBy: React.FC = () => {
      const { values, setValues } = useMultiValueSearchParam('genres');
      const { values: orderByValues } = useMultiValueSearchParam('orderBy');

      return (
        <>
          <span data-testid="genres">{JSON.stringify(values)}</span>
          <span data-testid="orderBy">{JSON.stringify(orderByValues)}</span>
          <button onClick={() => setValues(['Action'])}>Set</button>
        </>
      );
    };

    render(
      <MemoryRouter initialEntries={['/items?genres=Comedy&orderBy=title']}>
        <WithOrderBy />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Set' }));

    expect(
      JSON.parse(screen.getByTestId('orderBy').textContent!)
    ).toEqual(['title']);
  });

  it('removes the page param when clearing values with an empty array', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/items?genres=Action&page=5']}>
        <TwoParamHarness paramName="genres" newValues={[]} />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Set Values' }));

    expect(
      JSON.parse(screen.getByTestId('page-values').textContent!)
    ).toEqual([]);
  });
});
