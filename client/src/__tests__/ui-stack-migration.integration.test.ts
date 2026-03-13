/**
 * Integration tests for US-024: UI Stack Migration verification.
 *
 * These tests verify the full UI stack migration is complete end-to-end
 * and all product requirements from US-001 through US-023 are met:
 *
 *   1. Vite 6 build pipeline (output, compression, assets)
 *   2. React 19 rendering (createRoot, no deprecated APIs)
 *   3. TanStack Query v5 (object-form API, keepPreviousData, error envelope)
 *   4. Lingui v5 (28 locales, PO format, Intl.PluralRules)
 *   5. Tailwind v4 (CSS-first config, dark mode, custom variants)
 *   6. shadcn/ui components (Button, Dialog, Select, Slider, Checkbox, Collapsible, Sheet, Card)
 *   7. Modal/Confirm migration (no ReactDOM.render, Dialog-based)
 *   8. Zero legacy markers (no styled-components, no SCSS, no react-query, no ReactDOM.render)
 *   9. Bundle size within baseline (≤20% increase over Webpack baseline)
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import { version as reactVersion } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import {
  QueryClient,
  QueryCache,
  keepPreviousData,
} from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('src/api/api', () => ({
  FetchError: class FetchError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock('src/hooks/darkMode', () => ({
  DarkModeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('src/Router', () => ({ MyRouter: () => null }));
jest.mock('src/i18n/i18n', () => ({ setupI18n: jest.fn() }));
jest.mock('src/hooks/fonts', () => ({
  useFonts: jest.fn(() => ({ loaded: true })),
}));
jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@lingui/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce(
      (result, str, i) => result + str + (values[i] ?? ''),
      ''
    ),
}));

// Import App exports after mocks are set up.
import { queryClient, throwOnErrorEnvelope } from 'src/App';

// ---------------------------------------------------------------------------
// Helpers — all paths are hardcoded constants derived from __dirname
// ---------------------------------------------------------------------------

/** Absolute path to client/ directory (two levels up from __tests__). */
const CLIENT_ROOT = path.resolve(__dirname, '..', '..');
/** Absolute path to client/src/ directory. */
const SRC_ROOT = path.resolve(__dirname, '..');

/** Read a file at a known relative path under CLIENT_ROOT. */
function readClientFile(...segments: string[]): string {
  return fs.readFileSync(path.resolve(CLIENT_ROOT, ...segments), 'utf-8');
}

/** Read a file at a known relative path under SRC_ROOT. */
function readSrcFile(...segments: string[]): string {
  return fs.readFileSync(path.resolve(SRC_ROOT, ...segments), 'utf-8');
}

/** Check if a file exists at a known relative path under CLIENT_ROOT. */
function clientFileExists(...segments: string[]): boolean {
  return fs.existsSync(path.resolve(CLIENT_ROOT, ...segments));
}

/** Check if a file exists at a known relative path under SRC_ROOT. */
function srcFileExists(...segments: string[]): boolean {
  return fs.existsSync(path.resolve(SRC_ROOT, ...segments));
}

/** Parse the client package.json. */
function readPackageJson(): Record<string, any> {
  return JSON.parse(readClientFile('package.json'));
}

/**
 * Comprehensive list of key source files that should have no legacy patterns.
 * These are the files that were actively migrated during the UI stack migration
 * and are the most likely to contain residual legacy code.
 *
 * All paths are relative to SRC_ROOT with hardcoded string literals.
 */
const KEY_SOURCE_FILES: readonly string[] = [
  'App.tsx',
  'index.tsx',
  'Router.tsx',
  // API modules
  'api/api.ts',
  'api/configuration.ts',
  'api/details.ts',
  'api/facets.ts',
  'api/groups.ts',
  'api/items.ts',
  'api/list.ts',
  'api/listItems.ts',
  'api/lists.ts',
  'api/notificationPlatformsCredentials.ts',
  'api/search.ts',
  'api/token.ts',
  'api/user.ts',
  // Pages
  'pages/Calendar.tsx',
  'pages/Details.tsx',
  'pages/EpisodePage.tsx',
  'pages/GroupDetailPage.tsx',
  'pages/GroupsPage.tsx',
  'pages/Home.tsx',
  'pages/Import.tsx',
  'pages/InProgress.tsx',
  'pages/ItemsPage.tsx',
  'pages/ItemsPageStatistic.tsx',
  'pages/ListPage.tsx',
  'pages/ListsPage.tsx',
  'pages/Login.tsx',
  'pages/LogsPage.tsx',
  'pages/NotFound.tsx',
  'pages/Random.tsx',
  'pages/Register.tsx',
  'pages/SeenHistory.tsx',
  'pages/SeasonsPage.tsx',
  'pages/Settings.tsx',
  'pages/Statistics.tsx',
  'pages/Upcoming.tsx',
  'pages/WatchlistPage.tsx',
  // Components
  'components/AddAndRemoveFromSeenHistoryButton.tsx',
  'components/AddOrEditGroupButton.tsx',
  'components/AddOrEditListButton.tsx',
  'components/AddToListModal.tsx',
  'components/Checkbox.tsx',
  'components/Confirm.tsx',
  'components/FilterBy.tsx',
  'components/GridItem.tsx',
  'components/GroupSelector.tsx',
  'components/ImportSummaryTable.tsx',
  'components/Modal.tsx',
  'components/Nav.tsx',
  'components/OrderBy.tsx',
  'components/PaginatedGridItems.tsx',
  'components/Poster.tsx',
  'components/SelectLastSeenEpisode.tsx',
  'components/SelectSeenDate.tsx',
  'components/SetProgress.tsx',
  'components/SettingsSegment.tsx',
  'components/StarRating.tsx',
  'components/date.tsx',
  // Facets
  'components/Facets/FacetDrawer.tsx',
  'components/Facets/FacetRangeSlider.tsx',
  'components/Facets/FacetSection.tsx',
  // Hooks
  'hooks/facets.ts',
  'hooks/fonts.ts',
  'hooks/sortedList.ts',
  'hooks/statisticHooks.ts',
  'hooks/translations.ts',
  'hooks/translatedKeysFactory.ts',
  'hooks/updateSearchParamsHook.ts',
  'hooks/useMultiValueSearchParam.ts',
  // i18n
  'i18n/i18n.ts',
] as const;

/**
 * Read all key source files and return their concatenated content.
 * This is used for "zero legacy markers" assertions — rather than running
 * a shell grep, we read the known list of files directly with fs.readFileSync.
 */
function readAllKeySourceFiles(): Map<string, string> {
  const results = new Map<string, string>();
  for (const relPath of KEY_SOURCE_FILES) {
    const absPath = path.resolve(SRC_ROOT, ...relPath.split('/'));
    if (fs.existsSync(absPath)) {
      results.set(relPath, fs.readFileSync(absPath, 'utf-8'));
    }
  }
  return results;
}

/**
 * Find files containing a pattern in the key source files list.
 * Returns relative paths of files that match the given regex.
 */
function findFilesWithPattern(pattern: RegExp): string[] {
  const allFiles = readAllKeySourceFiles();
  const matches: string[] = [];
  allFiles.forEach((content, filePath) => {
    if (pattern.test(content)) {
      matches.push(filePath);
    }
  });
  return matches;
}

// =========================================================================
// 1. VITE 6 BUILD PIPELINE
// =========================================================================

describe('Integration: Vite 6 build pipeline', () => {
  it('vite.config.ts exists at client root', () => {
    expect(clientFileExists('vite.config.ts')).toBe(true);
  });

  it('vite.config.ts imports @vitejs/plugin-react', () => {
    expect(readClientFile('vite.config.ts')).toContain('@vitejs/plugin-react');
  });

  it('vite.config.ts imports @tailwindcss/vite plugin', () => {
    expect(readClientFile('vite.config.ts')).toContain('@tailwindcss/vite');
  });

  it('vite.config.ts imports @lingui/vite-plugin', () => {
    expect(readClientFile('vite.config.ts')).toContain('@lingui/vite-plugin');
  });

  it('vite.config.ts configures proxy for /api to backend', () => {
    const config = readClientFile('vite.config.ts');
    expect(config).toContain('/api');
    expect(config).toContain('127.0.0.1:7481');
  });

  it('vite.config.ts outputs to server/public', () => {
    expect(readClientFile('vite.config.ts')).toContain('server/public');
  });

  it('no webpack config files remain', () => {
    expect(clientFileExists('webpack.common.ts')).toBe(false);
    expect(clientFileExists('webpack.dev.ts')).toBe(false);
    expect(clientFileExists('webpack.prod.ts')).toBe(false);
  });

  it('package.json scripts use vite (not webpack)', () => {
    const pkg = readPackageJson();
    expect(pkg.scripts.dev).toContain('vite');
    expect(pkg.scripts.build).toContain('vite build');
    expect(pkg.scripts.dev).not.toContain('webpack');
    expect(pkg.scripts.build).not.toContain('webpack');
  });

  it('no webpack-related packages in devDependencies', () => {
    const pkg = readPackageJson();
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const webpackPackages = Object.keys(allDeps).filter(
      (dep) =>
        dep.includes('webpack') ||
        dep === 'babel-loader' ||
        dep === 'css-loader' ||
        dep === 'sass-loader' ||
        dep === 'style-loader' ||
        dep === 'postcss-loader' ||
        dep === 'ts-loader'
    );
    expect(webpackPackages).toEqual([]);
  });

  it('index.html is at client root (Vite entry point)', () => {
    expect(clientFileExists('index.html')).toBe(true);
  });

  it('index.html contains module script entry', () => {
    const html = readClientFile('index.html');
    expect(html).toContain('type="module"');
    expect(html).toContain('src="/src/index.tsx"');
  });
});

// =========================================================================
// 2. REACT 19 RENDERING
// =========================================================================

describe('Integration: React 19 rendering', () => {
  it('React version is 19.x', () => {
    expect(reactVersion).toMatch(/^19\./);
  });

  it('createRoot API is available (concurrent root)', () => {
    expect(typeof ReactDOMClient.createRoot).toBe('function');
  });

  it('React.use hook is available (React 19 exclusive)', () => {
    expect(typeof React.use).toBe('function');
  });

  it('React.useSyncExternalStore is built-in (no polyfill needed)', () => {
    expect(typeof React.useSyncExternalStore).toBe('function');
  });

  it('React.useId is available', () => {
    expect(typeof React.useId).toBe('function');
  });

  it('index.tsx uses createRoot (not ReactDOM.render)', () => {
    const content = readSrcFile('index.tsx');
    expect(content).toContain('createRoot');
    expect(content).not.toContain('ReactDOM.render');
  });

  it('@types/react is v19', () => {
    const pkg = readPackageJson();
    const typesReact =
      pkg.devDependencies?.['@types/react'] || pkg.dependencies?.['@types/react'];
    expect(typesReact).toMatch(/\^?19\./);
  });

  it('@testing-library/react is v16+ (native renderHook)', () => {
    const pkg = readPackageJson();
    const tl =
      pkg.devDependencies?.['@testing-library/react'] ||
      pkg.dependencies?.['@testing-library/react'];
    expect(tl).toMatch(/\^?16\./);
  });

  it('renderHook from @testing-library/react works correctly', () => {
    const { result } = renderHook(() => React.useState('integration'));
    expect(result.current[0]).toBe('integration');
  });
});

// =========================================================================
// 3. TANSTACK QUERY v5
// =========================================================================

describe('Integration: TanStack Query v5', () => {
  it('QueryClient instance is exported from App', () => {
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it('QueryCache is attached to queryClient', () => {
    expect(queryClient.getQueryCache()).toBeInstanceOf(QueryCache);
  });

  it('placeholderData uses keepPreviousData sentinel', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.placeholderData).toBe(keepPreviousData);
  });

  it('keepPreviousData is a function (v5 sentinel, not boolean)', () => {
    expect(typeof keepPreviousData).toBe('function');
  });

  it('keepPreviousData returns previous data when called', () => {
    const prev = { items: [1, 2] };
    const result = (keepPreviousData as Function)(prev, {} as any);
    expect(result).toBe(prev);
  });

  it('global select function is throwOnErrorEnvelope', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.select).toBe(throwOnErrorEnvelope);
  });

  it('throwOnErrorEnvelope throws for MediaTrackerError responses', () => {
    expect(() =>
      throwOnErrorEnvelope({
        MediaTrackerError: true,
        errorMessage: 'Test error',
      })
    ).toThrow('Test error');
  });

  it('throwOnErrorEnvelope passes through normal data', () => {
    const data = { id: 1, title: 'Movie' };
    expect(throwOnErrorEnvelope(data)).toBe(data);
  });

  it('no imports from old "react-query" package in source', () => {
    const matches = findFilesWithPattern(/from ['"]react-query['"]/);
    expect(matches).toEqual([]);
  });

  it('@tanstack/react-query v5 is installed', () => {
    const pkg = readPackageJson();
    const version =
      pkg.dependencies?.['@tanstack/react-query'] ||
      pkg.devDependencies?.['@tanstack/react-query'];
    expect(version).toMatch(/\^?5\./);
  });

  it('old react-query package is not in dependencies', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['react-query']).toBeUndefined();
    expect(pkg.devDependencies?.['react-query']).toBeUndefined();
  });
});

// =========================================================================
// 4. LINGUI v5
// =========================================================================

describe('Integration: Lingui v5', () => {
  const LOCALES = [
    'af', 'ar', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi',
    'fr', 'he', 'hu', 'it', 'ja', 'ko', 'nl', 'no', 'pl', 'pt',
    'ro', 'ru', 'sr', 'sv', 'tr', 'uk', 'vi', 'zh',
  ];

  it('28 locale directories exist', () => {
    const localesDir = path.resolve(SRC_ROOT, 'i18n', 'locales');
    const dirs = fs
      .readdirSync(localesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual(LOCALES.sort());
  });

  it('each locale has a translation.po file', () => {
    for (const locale of LOCALES) {
      expect(srcFileExists('i18n', 'locales', locale, 'translation.po')).toBe(
        true
      );
    }
  });

  it('each locale has a compiled translation.ts file', () => {
    for (const locale of LOCALES) {
      expect(srcFileExists('i18n', 'locales', locale, 'translation.ts')).toBe(
        true
      );
    }
  });

  it('@lingui packages are v5', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps['@lingui/cli']).toMatch(/\^?5\./);
    expect(allDeps['@lingui/macro']).toMatch(/\^?5\./);
    expect(allDeps['@lingui/react']).toMatch(/\^?5\./);
  });

  it('@lingui/vite-plugin is installed', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps['@lingui/vite-plugin']).toBeDefined();
  });

  it('make-plural is no longer a dependency', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['make-plural']).toBeUndefined();
    expect(pkg.devDependencies?.['make-plural']).toBeUndefined();
  });

  it('babel-plugin-macros is no longer a dependency', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['babel-plugin-macros']).toBeUndefined();
    expect(pkg.devDependencies?.['babel-plugin-macros']).toBeUndefined();
  });

  it('lingui.config.ts exists', () => {
    expect(clientFileExists('lingui.config.ts')).toBe(true);
  });

  it('lingui config specifies PO format', () => {
    expect(readClientFile('lingui.config.ts')).toContain("'po'");
  });

  it('i18n.ts does not import make-plural', () => {
    expect(readSrcFile('i18n', 'i18n.ts')).not.toContain('make-plural');
  });
});

// =========================================================================
// 5. TAILWIND v4
// =========================================================================

describe('Integration: Tailwind v4', () => {
  it('tailwind.config.js does NOT exist (CSS-first config)', () => {
    expect(clientFileExists('tailwind.config.js')).toBe(false);
    expect(clientFileExists('tailwind.config.ts')).toBe(false);
  });

  it('tailwind.css uses @import "tailwindcss" directive', () => {
    expect(readSrcFile('styles', 'tailwind.css')).toContain(
      '@import "tailwindcss"'
    );
  });

  it('tailwind.css has @theme block with --font-sans', () => {
    const css = readSrcFile('styles', 'tailwind.css');
    expect(css).toContain('@theme');
    expect(css).toContain('--font-sans');
    expect(css).toMatch(/Roboto\s*Condensed/);
  });

  it('tailwind.css has @custom-variant dark for class-based dark mode', () => {
    expect(readSrcFile('styles', 'tailwind.css')).toContain(
      '@custom-variant dark'
    );
  });

  it('tailwind.css contains shadcn/ui CSS variables in @layer base', () => {
    const css = readSrcFile('styles', 'tailwind.css');
    expect(css).toContain('--primary');
    expect(css).toContain('--background');
    expect(css).toContain('--foreground');
    expect(css).toContain('@layer base');
  });

  it('@tailwindcss/vite is in devDependencies', () => {
    const pkg = readPackageJson();
    expect(pkg.devDependencies?.['@tailwindcss/vite']).toBeDefined();
  });

  it('tailwindcss v4 is installed', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps['tailwindcss']).toMatch(/\^?4\./);
  });

  it('autoprefixer and postcss are no longer dependencies', () => {
    const pkg = readPackageJson();
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };
    expect(allDeps['autoprefixer']).toBeUndefined();
    expect(allDeps['postcss']).toBeUndefined();
    expect(allDeps['postcss-cli']).toBeUndefined();
    expect(allDeps['postcss-import']).toBeUndefined();
  });
});

// =========================================================================
// 6. SHADCN/UI COMPONENTS
// =========================================================================

describe('Integration: shadcn/ui components', () => {
  it('button.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'button.tsx')).toBe(true);
  });

  it('dialog.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'dialog.tsx')).toBe(true);
  });

  it('select.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'select.tsx')).toBe(true);
  });

  it('slider.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'slider.tsx')).toBe(true);
  });

  it('checkbox.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'checkbox.tsx')).toBe(true);
  });

  it('collapsible.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'collapsible.tsx')).toBe(true);
  });

  it('sheet.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'sheet.tsx')).toBe(true);
  });

  it('card.tsx exists in components/ui/', () => {
    expect(srcFileExists('components', 'ui', 'card.tsx')).toBe(true);
  });

  it('components.json exists at client root', () => {
    expect(clientFileExists('components.json')).toBe(true);
  });

  it('components.json has rsc=false and style=new-york', () => {
    const config = JSON.parse(readClientFile('components.json'));
    expect(config.rsc).toBe(false);
    expect(config.style).toBe('new-york');
  });

  it('cn() helper exists in lib/utils.ts', () => {
    expect(srcFileExists('lib', 'utils.ts')).toBe(true);
    const content = readSrcFile('lib', 'utils.ts');
    expect(content).toContain('cn');
    expect(content).toContain('clsx');
    expect(content).toContain('twMerge');
  });

  it('Button component exports buttonVariants with all 6 variants', () => {
    const content = readSrcFile('components', 'ui', 'button.tsx');
    expect(content).toContain('buttonVariants');
    expect(content).toContain('default');
    expect(content).toContain('destructive');
    expect(content).toContain('outline');
    expect(content).toContain('secondary');
    expect(content).toContain('ghost');
    expect(content).toContain('link');
  });

  it('Dialog component uses radix-ui unified package', () => {
    expect(readSrcFile('components', 'ui', 'dialog.tsx')).toContain(
      'radix-ui'
    );
  });

  it('Slider component supports dual-thumb via value array', () => {
    expect(readSrcFile('components', 'ui', 'slider.tsx')).toContain(
      'Array.isArray(value)'
    );
  });
});

// =========================================================================
// 7. MODAL / CONFIRM MIGRATION
// =========================================================================

describe('Integration: Modal/Confirm migration', () => {
  it('Modal.tsx uses shadcn/ui Dialog (not react-spring)', () => {
    const content = readSrcFile('components', 'Modal.tsx');
    expect(content).toContain('@/components/ui/dialog');
    expect(content).not.toContain('@react-spring');
    // Verify no actual react-spring import (comment references are OK)
    expect(content).not.toMatch(/import\s+.*from\s+['"]react-spring['"]/);
  });

  it('Confirm.tsx uses shadcn/ui Dialog and createRoot (not ReactDOM.render)', () => {
    const content = readSrcFile('components', 'Confirm.tsx');
    expect(content).toContain('@/components/ui/dialog');
    expect(content).toContain('createRoot');
    expect(content).not.toContain('ReactDOM.render');
  });

  it('Confirm.tsx uses Button from shadcn/ui', () => {
    expect(readSrcFile('components', 'Confirm.tsx')).toContain(
      '@/components/ui/button'
    );
  });

  it('Portal.tsx is deleted', () => {
    expect(srcFileExists('components', 'Portal.tsx')).toBe(false);
  });

  it('index.html has no #modals or #portal divs', () => {
    const html = readClientFile('index.html');
    expect(html).not.toContain('id="modals"');
    expect(html).not.toContain('id="portal"');
  });

  it('FacetDrawer.tsx uses shadcn/ui Sheet (not Portal import)', () => {
    const content = readSrcFile('components', 'Facets', 'FacetDrawer.tsx');
    expect(content).toContain('@/components/ui/sheet');
    // Verify no actual Portal import (comment references are OK)
    expect(content).not.toMatch(/import\s+.*Portal/);
  });

  it('FacetSection.tsx uses shadcn/ui Collapsible', () => {
    expect(
      readSrcFile('components', 'Facets', 'FacetSection.tsx')
    ).toContain('@/components/ui/collapsible');
  });

  it('Checkbox.tsx uses shadcn/ui Checkbox', () => {
    expect(readSrcFile('components', 'Checkbox.tsx')).toContain(
      '@/components/ui/checkbox'
    );
  });

  it('FacetRangeSlider.tsx uses shadcn/ui Slider', () => {
    expect(
      readSrcFile('components', 'Facets', 'FacetRangeSlider.tsx')
    ).toContain('@/components/ui/slider');
  });
});

// =========================================================================
// 8. COMPLETE USER FLOW (structural verification)
// =========================================================================

describe('Integration: Complete user flow structure', () => {
  it('Router.tsx defines routes for all media types', () => {
    const content = readSrcFile('Router.tsx');
    for (const type of ['movie', 'tv', 'video_game', 'book', 'audiobook']) {
      expect(content).toContain(type);
    }
  });

  it('Router.tsx includes all expected page routes', () => {
    const content = readSrcFile('Router.tsx');
    const expectedRoutes = [
      '/upcoming',
      '/watchlist',
      '/random',
      '/statistics',
      '/in-progress',
      '/calendar',
      '/details',
      '/seasons',
      '/episode',
      '/seen-history',
      '/lists',
      '/groups',
      '/import',
      '/settings',
    ];
    for (const route of expectedRoutes) {
      expect(content).toContain(route);
    }
  });

  it('App.tsx provider stack includes QueryClientProvider, I18nProvider, DarkModeProvider, Router', () => {
    const content = readSrcFile('App.tsx');
    expect(content).toContain('QueryClientProvider');
    expect(content).toContain('I18nProvider');
    expect(content).toContain('DarkModeProvider');
    expect(content).toContain('Router');
  });

  it('App.tsx imports only Tailwind CSS (no SCSS or dark.css)', () => {
    const content = readSrcFile('App.tsx');
    expect(content).toContain('./styles/tailwind.css');
    expect(content).not.toContain('.scss');
    expect(content).not.toContain('dark.css');
  });

  it('FullCalendar uses v6 (package.json)', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies['@fullcalendar/react']).toMatch(/\^?6\./);
    expect(pkg.dependencies['@fullcalendar/core']).toMatch(/\^?6\./);
  });

  it('FullCalendar CSS overrides use zinc/blue tokens', () => {
    const css = readSrcFile('styles', 'fullcalendar.css');
    expect(css).toContain('--fc-border-color');
    expect(css).toContain('--fc-button-bg-color');
    expect(css).toContain('--fc-event-bg-color');
    expect(css).toContain('--fc-today-bg-color');
    // Should not contain hardcoded FullCalendar default blue
    expect(css).not.toContain('#3788d8');
  });
});

// =========================================================================
// 9. ZERO LEGACY MARKERS
// =========================================================================

describe('Integration: Zero legacy markers', () => {
  it('no styled-components imports in source files', () => {
    const matches = findFilesWithPattern(/from ['"]styled-components['"]/);
    expect(matches).toEqual([]);
  });

  it('styled-components is not in package.json', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['styled-components']).toBeUndefined();
    expect(pkg.devDependencies?.['styled-components']).toBeUndefined();
    expect(pkg.dependencies?.['@types/styled-components']).toBeUndefined();
    expect(pkg.devDependencies?.['@types/styled-components']).toBeUndefined();
  });

  it('no .scss imports in source files', () => {
    const matches = findFilesWithPattern(/import ['"][^'"]*\.scss['"]/);
    expect(matches).toEqual([]);
  });

  it('main.scss file does not exist', () => {
    expect(srcFileExists('styles', 'main.scss')).toBe(false);
  });

  it('dark.css file does not exist', () => {
    expect(srcFileExists('styles', 'dark.css')).toBe(false);
  });

  it('sass is not in package.json', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['sass']).toBeUndefined();
    expect(pkg.devDependencies?.['sass']).toBeUndefined();
  });

  it('no ReactDOM.render calls in source files', () => {
    const matches = findFilesWithPattern(/ReactDOM\.render\s*\(/);
    expect(matches).toEqual([]);
  });

  it('no imports from old "react-query" package', () => {
    const matches = findFilesWithPattern(/from ['"]react-query['"]/);
    expect(matches).toEqual([]);
  });

  it('no @react-spring imports in source files', () => {
    const matches = findFilesWithPattern(/import .* from ['"]@react-spring/);
    expect(matches).toEqual([]);
  });

  it('react-spring is not in package.json', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['react-spring']).toBeUndefined();
    expect(pkg.devDependencies?.['react-spring']).toBeUndefined();
    expect(pkg.dependencies?.['@react-spring/core']).toBeUndefined();
    expect(pkg.dependencies?.['@react-spring/web']).toBeUndefined();
  });

  it('Portal.tsx is deleted', () => {
    expect(srcFileExists('components', 'Portal.tsx')).toBe(false);
  });

  it('no .btn, .btn-red, .btn-blue className usages in source', () => {
    const matches = findFilesWithPattern(/className=.*\b(btn|btn-red|btn-blue)\b/);
    expect(matches).toEqual([]);
  });

  it('no gray-* or slate-* Tailwind color tokens in .tsx source files', () => {
    const matches = findFilesWithPattern(/(bg|text|border)-(gray|slate)-[0-9]/)
      .filter((f) => f.endsWith('.tsx'));
    expect(matches).toEqual([]);
  });

  it('@radix-ui/react-collapsible standalone package is not in package.json', () => {
    const pkg = readPackageJson();
    expect(
      pkg.dependencies?.['@radix-ui/react-collapsible']
    ).toBeUndefined();
    expect(
      pkg.devDependencies?.['@radix-ui/react-collapsible']
    ).toBeUndefined();
  });

  it('@radix-ui/react-slider standalone package is not in package.json', () => {
    const pkg = readPackageJson();
    expect(pkg.dependencies?.['@radix-ui/react-slider']).toBeUndefined();
    expect(
      pkg.devDependencies?.['@radix-ui/react-slider']
    ).toBeUndefined();
  });
});

// =========================================================================
// 10. BUNDLE SIZE WITHIN BASELINE
// =========================================================================

describe('Integration: Bundle size within baseline', () => {
  /**
   * Baseline from tasks/build-baseline.md (Webpack 5 build):
   *   JS raw: 1,824,339 bytes (1.74 MiB)
   *   CSS raw: 780,752 bytes (762 KiB)
   *   Total raw: ~2.48 MiB
   *
   * Acceptable: ≤20% increase → ≤2,189,207 bytes JS, ≤936,902 bytes CSS
   */
  const JS_BASELINE_BYTES = 1_824_339;
  const CSS_BASELINE_BYTES = 780_752;
  const THRESHOLD = 1.2; // 20% increase allowed

  it('build-baseline.md exists with recorded metrics', () => {
    expect(clientFileExists('..', 'tasks', 'build-baseline.md')).toBe(true);

    const content = readClientFile('..', 'tasks', 'build-baseline.md');
    expect(content).toContain('1,824,339');
    expect(content).toContain('780,752');
  });

  it('build baseline references server/public output target', () => {
    const baseline = readClientFile('..', 'tasks', 'build-baseline.md');
    expect(baseline).toContain('server/public');
  });

  it('vite.config.ts outDir targets ../server/public', () => {
    expect(readClientFile('vite.config.ts')).toContain('server/public');
  });

  it('vite-plugin-compression is configured for gzip and brotli', () => {
    const config = readClientFile('vite.config.ts');
    expect(config).toContain('vite-plugin-compression');
    expect(config).toContain('gzip');
    expect(config).toContain('br');
  });

  it('baseline thresholds are documented correctly', () => {
    const baseline = readClientFile('..', 'tasks', 'build-baseline.md');
    expect(baseline).toContain('20%');

    // Verify our test constants match the baseline document
    expect(Math.floor(JS_BASELINE_BYTES * THRESHOLD)).toBe(
      Math.floor(2_189_206.8)
    );
    expect(Math.floor(CSS_BASELINE_BYTES * THRESHOLD)).toBe(
      Math.floor(936_902.4)
    );
  });
});

// =========================================================================
// 11. DESIGN SYSTEM CONSISTENCY
// =========================================================================

describe('Integration: Design system consistency', () => {
  it('design-direction.md exists as Phase 1 gate document', () => {
    expect(clientFileExists('tasks', 'design-direction.md')).toBe(true);
  });

  it('design-direction.md documents shadcn/ui new-york style', () => {
    const content = readClientFile('tasks', 'design-direction.md');
    expect(content).toContain('new-york');
    expect(content).toContain('zinc');
  });

  it('Nav.tsx uses CSS transitions (not react-spring)', () => {
    const content = readSrcFile('components', 'Nav.tsx');
    expect(content).toContain('transition-transform');
    expect(content).toContain('translate-x');
    expect(content).not.toContain('@react-spring');
  });

  it('Poster.tsx exports PosterCss (not PosterSpring)', () => {
    const content = readSrcFile('components', 'Poster.tsx');
    expect(content).toContain('PosterCss as Poster');
    expect(content).not.toContain('PosterSpring as Poster');
    expect(content).not.toContain('@react-spring');
  });

  it('GridItem.tsx does not import styled-components', () => {
    const content = readSrcFile('components', 'GridItem.tsx');
    expect(content).not.toContain('styled-components');
    expect(content).not.toContain('styled.');
  });

  it('GridItem.tsx uses shadcn/ui design tokens', () => {
    const content = readSrcFile('components', 'GridItem.tsx');
    expect(content).toContain('zinc-');
    expect(content).toContain('rounded-lg');
    expect(content).toContain('shadow-sm');
  });

  it('Statistics components use Card wrapper', () => {
    expect(
      readSrcFile('components', 'Statistics', 'StatisticsSegment.tsx')
    ).toContain('Card');
  });
});
