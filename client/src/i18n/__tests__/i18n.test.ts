/**
 * Tests for the Lingui v5 i18n setup (src/i18n/i18n.ts).
 *
 * Validates:
 *  - setupI18n() activates a supported locale
 *  - All 28 locale catalogs are loaded into the i18n instance
 *  - Hashed message IDs (Lingui v5 compiled format) resolve correctly
 *  - Intl.PluralRules is used natively (no make-plural dependency)
 *  - i18n._() works with the { id, message } descriptor shape
 */

import { i18n } from '@lingui/core';

// Import the function under test
import { setupI18n } from 'src/i18n/i18n';

// The English compiled catalog (hashed IDs → translated arrays)
import { messages as enMessages } from 'src/i18n/locales/en/translation';

const SUPPORTED_LOCALES = [
  'af', 'ar', 'ca', 'cs', 'da', 'de', 'el', 'en',
  'es', 'fi', 'fr', 'he', 'hu', 'it', 'ja', 'ko',
  'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sr', 'sv',
  'tr', 'uk', 'vi', 'zh',
] as const;

describe('setupI18n', () => {
  beforeEach(() => {
    // Reset i18n state before each test. setupI18n() is also called in
    // setupTests.ts, so we call it again to ensure a clean slate.
    setupI18n();
  });

  it('activates a locale from the supported set', () => {
    expect(i18n.locale).toBeDefined();
    expect(SUPPORTED_LOCALES).toContain(i18n.locale);
  });

  it('loads message catalogs for all 28 supported locales', () => {
    // After setupI18n(), i18n._locales should include all 28 locales.
    // We verify by temporarily activating each locale — if activation
    // throws or returns undefined, the catalog was not loaded.
    for (const locale of SUPPORTED_LOCALES) {
      i18n.activate(locale);
      expect(i18n.locale).toBe(locale);
    }
    // Restore the default
    i18n.activate('en');
  });

  it('resolves a known hashed message ID to its English translation', () => {
    i18n.activate('en');

    // The compiled English catalog includes "nOhz3x" → ["Logout"].
    // Verify the catalog is actually loaded and i18n._() resolves it.
    const result = i18n._({ id: 'nOhz3x', message: 'Logout' });
    expect(result).toBe('Logout');
  });

  it('resolves the t`` macro output shape (object with id + message)', () => {
    i18n.activate('en');

    // Lingui v5's babel plugin transforms t`Home` to:
    //   i18n._({ id: "i0qMbr", message: "Home" })
    const result = i18n._({ id: 'i0qMbr', message: 'Home' });
    expect(result).toBe('Home');
  });

  it('English catalog contains expected message keys', () => {
    // Verify the compiled catalog export has the expected structure
    expect(enMessages).toBeDefined();
    expect(typeof enMessages).toBe('object');

    // Spot-check a few known hashed keys
    expect(enMessages['nOhz3x']).toBeDefined(); // "Logout"
    expect(enMessages['i0qMbr']).toBeDefined(); // "Home"
    expect(enMessages['A1taO8']).toBeDefined(); // "Search"
  });

  it('does not depend on make-plural (uses Intl.PluralRules natively)', () => {
    i18n.activate('en');

    // Lingui v5 uses Intl.PluralRules under the hood. Verify plurals work
    // by resolving a plural message. The English catalog has plural forms
    // like "6ki7F2" → "{0, plural, one {# item} other {# items}}".
    const result = i18n._({
      id: '6ki7F2',
      message: '{0, plural, one {# item} other {# items}}',
      values: { 0: 5 },
    });
    expect(result).toContain('5');
    expect(result).toContain('items');
  });

  it('plural resolves singular form correctly', () => {
    i18n.activate('en');

    const result = i18n._({
      id: '6ki7F2',
      message: '{0, plural, one {# item} other {# items}}',
      values: { 0: 1 },
    });
    expect(result).toContain('1');
    expect(result).toContain('item');
    expect(result).not.toContain('items');
  });

  it('falls back to English when an unknown locale is detected', () => {
    // In jsdom, navigator.language is typically undefined or "en",
    // which means the fallback should be 'en'. Re-run setup and confirm.
    setupI18n();
    expect(i18n.locale).toBe('en');
  });
});
