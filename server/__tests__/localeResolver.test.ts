import { resolveLocale } from 'src/localeResolver';

/**
 * Unit tests for localeResolver.ts
 *
 * Tests RFC 9110 Accept-Language header parsing and negotiation
 * between the header's language preferences and the available languages.
 */
describe('resolveLocale', () => {
  const availableLanguages = ['en', 'es-419', 'fr'];

  // ---------------------------------------------------------------------------
  // Exact locale match
  // ---------------------------------------------------------------------------

  test('returns exact match when header exactly matches an available language', () => {
    const result = resolveLocale('en', availableLanguages);
    expect(result).toBe('en');
  });

  test('returns exact BCP 47 match for region-subtag language', () => {
    const result = resolveLocale('es-419', availableLanguages);
    expect(result).toBe('es-419');
  });

  test('returns matching language when header has quality values', () => {
    const result = resolveLocale('fr;q=0.9, en;q=0.8', availableLanguages);
    expect(result).toBe('fr');
  });

  test('respects quality values and returns highest-priority match', () => {
    const result = resolveLocale('en;q=0.5, fr;q=0.9', availableLanguages);
    expect(result).toBe('fr');
  });

  test('matches second preference when first is not available', () => {
    const result = resolveLocale('de;q=0.9, es-419;q=0.8', availableLanguages);
    expect(result).toBe('es-419');
  });

  // ---------------------------------------------------------------------------
  // No match cases
  // ---------------------------------------------------------------------------

  test('returns null when header has no matching language', () => {
    const result = resolveLocale('de', availableLanguages);
    expect(result).toBeNull();
  });

  test('returns null when header is undefined', () => {
    const result = resolveLocale(undefined, availableLanguages);
    expect(result).toBeNull();
  });

  test('returns null when header is empty string', () => {
    const result = resolveLocale('', availableLanguages);
    expect(result).toBeNull();
  });

  test('returns null when availableLanguages is empty', () => {
    const result = resolveLocale('en', []);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Case insensitivity
  // ---------------------------------------------------------------------------

  test('matches case-insensitively', () => {
    const result = resolveLocale('EN', availableLanguages);
    expect(result).toBe('en');
  });

  // ---------------------------------------------------------------------------
  // Wildcard handling
  // ---------------------------------------------------------------------------

  test('returns first available language when header is wildcard *', () => {
    const result = resolveLocale('*', availableLanguages);
    expect(result).toBe('en');
  });

  // ---------------------------------------------------------------------------
  // Complex headers
  // ---------------------------------------------------------------------------

  test('handles complex Accept-Language header with multiple languages', () => {
    const result = resolveLocale('zh-TW;q=1.0, ja;q=0.9, es-419;q=0.8', availableLanguages);
    expect(result).toBe('es-419');
  });

  test('returns null when all preferences are unmatched', () => {
    const result = resolveLocale('zh, ja, de', availableLanguages);
    expect(result).toBeNull();
  });
});
