jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('src/config', () => ({
  Config: {
    METADATA_LANGUAGES: null,
    AUDIBLE_LANG_MAP: null,
  },
}));

import { Config } from 'src/config';
import {
  getMetadataLanguages,
  getAudibleLangMap,
  toTmdbLang,
  _resetMetadataLanguagesCache,
  _resetAudibleLangMapCache,
} from 'src/metadataLanguages';
import { logger } from 'src/logger';

// Cast to allow mutation of mock properties
const mockConfig = Config as unknown as {
  METADATA_LANGUAGES: string[] | null;
  AUDIBLE_LANG_MAP: string | null;
};

beforeEach(() => {
  _resetMetadataLanguagesCache();
  _resetAudibleLangMapCache();
  jest.clearAllMocks();
  mockConfig.METADATA_LANGUAGES = null;
  mockConfig.AUDIBLE_LANG_MAP = null;
});

describe('toTmdbLang', () => {
  it('returns base subtag for BCP 47 tag with region', () => {
    expect(toTmdbLang('es-419')).toBe('es');
    expect(toTmdbLang('pt-BR')).toBe('pt');
    expect(toTmdbLang('zh-CN')).toBe('zh');
  });

  it('returns the tag as-is for simple ISO 639-1 codes', () => {
    expect(toTmdbLang('en')).toBe('en');
    expect(toTmdbLang('de')).toBe('de');
    expect(toTmdbLang('fr')).toBe('fr');
  });

  it('lowercases the base subtag', () => {
    expect(toTmdbLang('EN')).toBe('en');
    expect(toTmdbLang('ES-419')).toBe('es');
  });
});

describe('getMetadataLanguages', () => {
  it('falls back to ["en"] when METADATA_LANGUAGES is not set (null)', () => {
    mockConfig.METADATA_LANGUAGES = null;

    const result = getMetadataLanguages();
    expect(result).toEqual(['en']);
  });

  it('falls back to ["en"] when METADATA_LANGUAGES is empty array', () => {
    mockConfig.METADATA_LANGUAGES = [];

    const result = getMetadataLanguages();
    expect(result).toEqual(['en']);
  });

  it('parses valid codes correctly: en,es-419', () => {
    mockConfig.METADATA_LANGUAGES = ['en', 'es-419'];

    const result = getMetadataLanguages();
    expect(result).toEqual(['en', 'es-419']);
  });

  it('parses valid plain ISO codes', () => {
    mockConfig.METADATA_LANGUAGES = ['en', 'de', 'fr'];

    const result = getMetadataLanguages();
    expect(result).toEqual(['en', 'de', 'fr']);
  });

  it('skips invalid base codes and logs a warning', () => {
    mockConfig.METADATA_LANGUAGES = ['en', 'xx', 'es-419'];

    const result = getMetadataLanguages();
    expect(result).toEqual(['en', 'es-419']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid base language code 'xx'")
    );
  });

  it('falls back to ["en"] and logs warning when all codes are invalid', () => {
    mockConfig.METADATA_LANGUAGES = ['xx', 'yy'];

    const result = getMetadataLanguages();
    expect(result).toEqual(['en']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid base language code 'xx'")
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no valid language codes found')
    );
  });

  it('memoizes result after first call', () => {
    mockConfig.METADATA_LANGUAGES = ['en'];

    const first = getMetadataLanguages();
    // Change the config after first call — memoized result should be returned
    mockConfig.METADATA_LANGUAGES = ['de'];

    const second = getMetadataLanguages();
    expect(first).toBe(second); // same reference, memoized
    expect(second).toEqual(['en']);
  });

  it('validates that common tmdbLang codes are accepted as base codes', () => {
    const validCodes = ['en', 'de', 'fr', 'es', 'pt', 'ja', 'zh'];
    mockConfig.METADATA_LANGUAGES = validCodes;

    const result = getMetadataLanguages();
    expect(result).toEqual(validCodes);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps BCP 47 tags with valid base codes intact', () => {
    mockConfig.METADATA_LANGUAGES = ['es-419', 'pt-br', 'zh-cn'];

    const result = getMetadataLanguages();
    expect(result).toEqual(['es-419', 'pt-br', 'zh-cn']);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('rejects BCP 47 tags whose base code is not in tmdbLang', () => {
    mockConfig.METADATA_LANGUAGES = ['xx-us'];

    const result = getMetadataLanguages();
    expect(result).toEqual(['en']); // fallback
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("invalid base language code 'xx'")
    );
  });
});

describe('getAudibleLangMap', () => {
  it('returns default map when AUDIBLE_LANG_MAP is not set (null)', () => {
    mockConfig.AUDIBLE_LANG_MAP = null;

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
    expect(result.get('de')).toBe('de');
    expect(result.get('es')).toBe('es');
    expect(result.get('fr')).toBe('fr');
    expect(result.get('it')).toBe('it');
    expect(result.get('ja')).toBe('jp');
    expect(result.size).toBe(6);
  });

  it('returns default map when AUDIBLE_LANG_MAP is empty string', () => {
    mockConfig.AUDIBLE_LANG_MAP = '';

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
  });

  it('parses valid lang:country pairs', () => {
    mockConfig.AUDIBLE_LANG_MAP = 'en:us,de:de,es:es';

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
    expect(result.get('de')).toBe('de');
    expect(result.get('es')).toBe('es');
    expect(result.size).toBe(3);
  });

  it('handles whitespace around entries', () => {
    mockConfig.AUDIBLE_LANG_MAP = ' en : us , de : de ';

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
    expect(result.get('de')).toBe('de');
  });

  it('skips invalid entries missing a colon and logs a warning', () => {
    mockConfig.AUDIBLE_LANG_MAP = 'en:us,invalid_entry,de:de';

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
    expect(result.get('de')).toBe('de');
    expect(result.size).toBe(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing colon')
    );
  });

  it('skips entries with empty lang part and logs a warning', () => {
    mockConfig.AUDIBLE_LANG_MAP = ':us,en:us';

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
    expect(result.size).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('empty lang or country part')
    );
  });

  it('skips entries with empty country part and logs a warning', () => {
    mockConfig.AUDIBLE_LANG_MAP = 'en:,de:de';

    const result = getAudibleLangMap();
    expect(result.get('de')).toBe('de');
    expect(result.size).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('empty lang or country part')
    );
  });

  it('falls back to default map when all entries are invalid', () => {
    mockConfig.AUDIBLE_LANG_MAP = 'nocolon,alsoinvalid';

    const result = getAudibleLangMap();
    expect(result.get('en')).toBe('us');
    expect(result.get('ja')).toBe('jp');
  });

  it('memoizes result after first call', () => {
    mockConfig.AUDIBLE_LANG_MAP = 'en:us';

    const first = getAudibleLangMap();
    mockConfig.AUDIBLE_LANG_MAP = 'de:de';

    const second = getAudibleLangMap();
    expect(first).toBe(second); // same reference, memoized
    expect(second.get('en')).toBe('us');
    expect(second.has('de')).toBe(false);
  });
});
