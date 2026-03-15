jest.mock('axios');
jest.mock('src/repository/globalSettings', () => ({
  GlobalConfiguration: {
    configuration: {
      audibleLang: 'us',
    },
  },
}));
jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));
jest.mock('src/metadataLanguages', () => ({
  getAudibleLangMap: jest.fn(),
  toTmdbLang: jest.fn((tag: string) => tag.split('-')[0].toLowerCase()),
}));
jest.mock('src/config', () => ({
  Config: {
    METADATA_LANGUAGES: null,
    AUDIBLE_LANG_MAP: null,
  },
}));

import axios from 'axios';
import { Audible } from 'src/metadata/provider/audible';
import { getAudibleLangMap } from 'src/metadataLanguages';
import { logger } from 'src/logger';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetAudibleLangMap = getAudibleLangMap as jest.MockedFunction<typeof getAudibleLangMap>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

const audible = new Audible();

/**
 * Audible.localizedDetails tests.
 *
 * localizedDetails(ids, language) uses getAudibleLangMap() to resolve the
 * language code to an Audible country-code domain, then fetches from that
 * domain. Returns null if no mapping exists for the language.
 */
describe('Audible.localizedDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helper: build a typical Audible product response
  // ---------------------------------------------------------------------------

  function buildAudibleProductResponse(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      product: {
        asin: 'B001ABC123',
        title: 'The Great Gatsby',
        authors: [{ asin: 'OL12345A', name: 'F. Scott Fitzgerald' }],
        narrators: [{ name: 'Jake Gyllenhaal' }],
        product_images: {
          500: 'https://example.com/image500.jpg',
          1000: 'https://example.com/image1000.jpg',
          2400: 'https://example.com/image2400.jpg',
        },
        language: 'english',
        release_date: '2020-01-01',
        runtime_length_min: 300,
        merchandising_summary: 'A classic novel',
        ...overrides,
      },
      response_groups: ['contributors', 'media'],
    };
  }

  // ---------------------------------------------------------------------------
  // Returns null when no mapping exists for the language
  // ---------------------------------------------------------------------------

  describe('no mapping for language', () => {
    test('returns null when language has no entry in getAudibleLangMap()', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));

      const result = await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'zh');

      expect(result).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('logs a debug message when language has no mapping', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));

      await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'zh');

      expect(mockedLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no Audible domain mapping for language')
      );
    });

    test('returns null for BCP 47 tag with no mapping for the base language', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));

      // 'zh-TW' base is 'zh', which has no mapping
      const result = await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'zh-TW');

      expect(result).toBeNull();
    });

    test('returns null when audibleId is not provided', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));

      const result = await audible.localizedDetails({}, 'en');

      expect(result).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    test('logs a warning when audibleId is not provided', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));

      await audible.localizedDetails({}, 'en');

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no audibleId provided')
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Calls the correct Audible domain based on language mapping
  // ---------------------------------------------------------------------------

  describe('correct Audible domain per language', () => {
    test('calls the English (US) Audible domain for language "en"', async () => {
      mockedGetAudibleLangMap.mockReturnValue(
        new Map([['en', 'us'], ['de', 'de'], ['es', 'es']])
      );
      mockedAxios.get.mockResolvedValueOnce({
        data: buildAudibleProductResponse(),
        status: 200,
      });

      await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'en');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.audible.com/1.0/catalog/products/B001ABC123',
        expect.any(Object)
      );
    });

    test('calls the German Audible domain for language "de"', async () => {
      mockedGetAudibleLangMap.mockReturnValue(
        new Map([['en', 'us'], ['de', 'de'], ['es', 'es']])
      );
      mockedAxios.get.mockResolvedValueOnce({
        data: buildAudibleProductResponse({ title: 'Der grosse Gatsby' }),
        status: 200,
      });

      await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'de');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.audible.de/1.0/catalog/products/B001ABC123',
        expect.any(Object)
      );
    });

    test('calls the Spanish Audible domain for language "es"', async () => {
      mockedGetAudibleLangMap.mockReturnValue(
        new Map([['en', 'us'], ['de', 'de'], ['es', 'es']])
      );
      mockedAxios.get.mockResolvedValueOnce({
        data: buildAudibleProductResponse({ title: 'El Gran Gatsby' }),
        status: 200,
      });

      await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'es');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.audible.es/1.0/catalog/products/B001ABC123',
        expect.any(Object)
      );
    });

    test('extracts base language from BCP 47 tag (es-419 -> es)', async () => {
      mockedGetAudibleLangMap.mockReturnValue(
        new Map([['en', 'us'], ['es', 'es']])
      );
      mockedAxios.get.mockResolvedValueOnce({
        data: buildAudibleProductResponse({ title: 'El Gran Gatsby' }),
        status: 200,
      });

      await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'es-419');

      // 'es-419' base is 'es', so it maps to the 'es' country code
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.audible.es/1.0/catalog/products/B001ABC123',
        expect.any(Object)
      );
    });

    test('calls UK domain for country code "uk" (co.uk)', async () => {
      mockedGetAudibleLangMap.mockReturnValue(
        new Map([['en', 'uk']])
      );
      mockedAxios.get.mockResolvedValueOnce({
        data: buildAudibleProductResponse(),
        status: 200,
      });

      await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'en');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.audible.co.uk/1.0/catalog/products/B001ABC123',
        expect.any(Object)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Returns localized data correctly
  // ---------------------------------------------------------------------------

  describe('localized data extraction', () => {
    test('returns localized title and overview from the Audible response', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['de', 'de']]));
      mockedAxios.get.mockResolvedValueOnce({
        data: buildAudibleProductResponse({
          title: 'Der grosse Gatsby',
          merchandising_summary: 'Ein grosser amerikanischer Roman.',
        }),
        status: 200,
      });

      const result = await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'de');

      expect(result.title).toBe('Der grosse Gatsby');
      expect(result.overview).toBe('Ein grosser amerikanischer Roman.');
    });

    test('returns null when product has no title in response', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));
      mockedAxios.get.mockResolvedValueOnce({
        data: { product: {}, response_groups: [] },
        status: 200,
      });

      const result = await audible.localizedDetails({ audibleId: 'B001ABC123' }, 'en');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    test('throws when Audible API returns a non-200 status', async () => {
      mockedGetAudibleLangMap.mockReturnValue(new Map([['en', 'us']]));
      mockedAxios.get.mockResolvedValueOnce({
        data: {},
        status: 404,
        config: { url: 'https://api.audible.com/...' },
      });

      await expect(
        audible.localizedDetails({ audibleId: 'B001ABC123' }, 'en')
      ).rejects.toThrow();
    });
  });
});
