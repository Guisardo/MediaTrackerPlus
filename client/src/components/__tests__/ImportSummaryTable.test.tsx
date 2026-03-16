import React from 'react';
import { render, screen } from '@testing-library/react';

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

import {
  ImportSummaryTable,
  ImportSummaryTableRowComponent,
  TvImportSummaryTable,
  TvImportSummaryTableRowComponent,
} from '../ImportSummaryTable';

describe('ImportSummaryTable', () => {
  it('renders with column header and rows', () => {
    render(
      <ImportSummaryTable
        column="Books"
        rows={[
          { title: 'Watchlist', exported: 10, imported: 8 },
          { title: 'History', exported: 5, imported: 5 },
        ]}
      />
    );

    expect(screen.getByText('Books')).toBeInTheDocument();
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('renders empty rows array without crashing', () => {
    const { container } = render(
      <ImportSummaryTable column="Games" rows={[]} />
    );
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelector('tbody')!.children.length).toBe(0);
  });

  it('uses key prop when provided, falls back to title', () => {
    const { container } = render(
      <ImportSummaryTable
        column="Movies"
        rows={[
          { key: 'custom-key', title: 'Row One', exported: 1, imported: 1 },
          { title: 'Row Two', exported: 2, imported: 2 },
        ]}
      />
    );
    expect(screen.getByText('Row One')).toBeInTheDocument();
    expect(screen.getByText('Row Two')).toBeInTheDocument();
  });
});

describe('ImportSummaryTableRowComponent', () => {
  it('renders title and cell with exported/imported values', () => {
    render(
      <table>
        <tbody>
          <ImportSummaryTableRowComponent title="Watchlist" exported={10} imported={8} />
        </tbody>
      </table>
    );
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === '8 / 10')).toBeInTheDocument();
  });

  it('renders question mark when imported is 0 but exported > 0', () => {
    render(
      <table>
        <tbody>
          <ImportSummaryTableRowComponent title="History" exported={5} imported={0} />
        </tbody>
      </table>
    );
    expect(screen.getByText((_, el) => el?.textContent === '? / 5')).toBeInTheDocument();
  });

  it('renders empty cell when exported is 0', () => {
    const { container } = render(
      <table>
        <tbody>
          <ImportSummaryTableRowComponent title="Empty" exported={0} imported={0} />
        </tbody>
      </table>
    );
    const cells = container.querySelectorAll('td');
    expect(cells[0].textContent).toBe('Empty');
    expect(cells[1].textContent).toBe('');
  });

  it('renders empty cell when exported is undefined', () => {
    const { container } = render(
      <table>
        <tbody>
          <ImportSummaryTableRowComponent title="No data" />
        </tbody>
      </table>
    );
    const cells = container.querySelectorAll('td');
    expect(cells[1].textContent).toBe('');
  });
});

describe('TvImportSummaryTable', () => {
  it('renders header cells for Movies, Shows, Seasons, Episodes', () => {
    render(
      <TvImportSummaryTable
        rows={[
          {
            title: 'Watchlist',
            exported: { movies: 10, shows: 5, seasons: 20, episodes: 100 },
            imported: { movies: 8, shows: 4, seasons: 18, episodes: 90 },
          },
        ]}
      />
    );
    expect(screen.getByText('Watchlist')).toBeInTheDocument();
  });

  it('renders empty rows array without crashing', () => {
    const { container } = render(<TvImportSummaryTable rows={[]} />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });
});

describe('TvImportSummaryTableRowComponent', () => {
  it('renders title and cells for all four media categories', () => {
    const { container } = render(
      <table>
        <tbody>
          <TvImportSummaryTableRowComponent
            title="History"
            exported={{ movies: 10, shows: 5, seasons: 20, episodes: 100 }}
            imported={{ movies: 8, shows: 4, seasons: 18, episodes: 90 }}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('History')).toBeInTheDocument();
    const cells = container.querySelectorAll('td');
    expect(cells.length).toBe(5);
  });

  it('renders cells with partial data', () => {
    const { container } = render(
      <table>
        <tbody>
          <TvImportSummaryTableRowComponent
            title="Partial"
            exported={{ movies: 3 }}
            imported={{ movies: 2 }}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === '2 / 3')).toBeInTheDocument();
  });
});
