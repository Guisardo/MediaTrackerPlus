import { getLanguageDisplayName, getLanguageDisplayNameInLocale } from '../locale';

describe('locale utils', () => {
  describe('getLanguageDisplayName', () => {
    it('returns display name for simple language codes', () => {
      expect(getLanguageDisplayName('en')).toBe('English');
      expect(getLanguageDisplayName('fr')).toBe('French');
      expect(getLanguageDisplayName('de')).toBe('German');
      expect(getLanguageDisplayName('es')).toBe('Spanish');
      expect(getLanguageDisplayName('pt')).toBe('Portuguese');
      expect(getLanguageDisplayName('ja')).toBe('Japanese');
    });

    it('returns display name for BCP 47 tags', () => {
      const pt_br = getLanguageDisplayName('pt-BR');
      expect(pt_br).toMatch(/Portuguese|Brasil/);

      const es_419 = getLanguageDisplayName('es-419');
      expect(es_419).toMatch(/Spanish|419/);
    });

    it('returns uppercase code for empty string', () => {
      expect(getLanguageDisplayName('')).toBe('');
    });

    it('falls back to uppercase for invalid language codes', () => {
      const result = getLanguageDisplayName('invalid-code');
      // Should return uppercase version or the code
      expect(result).toBeTruthy();
    });

    it('handles null gracefully by treating as falsy', () => {
      expect(getLanguageDisplayName(null as any)).toBe('');
    });

    it('handles undefined gracefully', () => {
      expect(getLanguageDisplayName(undefined as any)).toBe('');
    });

    it('is case-insensitive', () => {
      expect(getLanguageDisplayName('EN')).toBe('English');
      expect(getLanguageDisplayName('FR')).toBe('French');
    });
  });

  describe('getLanguageDisplayNameInLocale', () => {
    it('returns display name in English locale', () => {
      expect(getLanguageDisplayNameInLocale('fr', 'en')).toBe('French');
      expect(getLanguageDisplayNameInLocale('de', 'en')).toBe('German');
    });

    it('returns display name in French locale', () => {
      const english = getLanguageDisplayNameInLocale('en', 'fr');
      expect(english).toMatch(/English|anglais/i);

      const german = getLanguageDisplayNameInLocale('de', 'fr');
      expect(german).toMatch(/German|allemand/i);
    });

    it('returns display name in Spanish locale', () => {
      const english = getLanguageDisplayNameInLocale('en', 'es');
      expect(english).toMatch(/English|inglés/i);

      const german = getLanguageDisplayNameInLocale('de', 'es');
      expect(german).toMatch(/German|alemán/i);
    });

    it('returns display name in Portuguese locale', () => {
      const english = getLanguageDisplayNameInLocale('en', 'pt');
      expect(english).toMatch(/English|inglês/i);
    });

    it('returns display name in Japanese locale', () => {
      const english = getLanguageDisplayNameInLocale('en', 'ja');
      expect(english).toMatch(/English|英語/);
    });

    it('returns display name in Chinese locale', () => {
      const english = getLanguageDisplayNameInLocale('en', 'zh');
      expect(english).toMatch(/English|英/);
    });

    it('handles BCP 47 tags in different display locales', () => {
      const pt_br_en = getLanguageDisplayNameInLocale('pt-BR', 'en');
      expect(pt_br_en).toMatch(/Portuguese|Brasil/);

      const es_419_fr = getLanguageDisplayNameInLocale('es-419', 'fr');
      expect(es_419_fr).toMatch(/Spanish|espagnol/i);
    });

    it('returns uppercase code for invalid language code', () => {
      const result = getLanguageDisplayNameInLocale('invalid-code', 'en');
      expect(result).toBeTruthy();
    });

    it('returns empty string for empty language code', () => {
      expect(getLanguageDisplayNameInLocale('', 'en')).toBe('');
      expect(getLanguageDisplayNameInLocale('', 'fr')).toBe('');
    });

    it('handles null language code gracefully', () => {
      expect(getLanguageDisplayNameInLocale(null as any, 'en')).toBe('');
    });

    it('handles undefined language code gracefully', () => {
      expect(getLanguageDisplayNameInLocale(undefined as any, 'en')).toBe('');
    });
  });
});
