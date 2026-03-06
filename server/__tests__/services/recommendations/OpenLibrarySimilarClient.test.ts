import { AxiosInstance } from 'axios';

import { OpenLibrarySimilarClient } from 'src/services/recommendations/OpenLibrarySimilarClient';
import { SimilarItem } from 'src/services/recommendations/types';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

/**
 * Build a minimal work details response with optional subjects.
 */
function makeWorkDetailsResponse(overrides: {
  key?: string;
  title?: string;
  subjects?: string[];
}): { data: { key: string; title: string; subjects?: string[] }; status: number } {
  return {
    data: {
      key: overrides.key ?? '/works/OL82563W',
      title: overrides.title ?? 'Test Work',
      subjects: overrides.subjects,
    },
    status: 200,
  };
}

/**
 * Build a minimal subject response with a works array.
 */
function makeSubjectResponse(
  works: Array<{ key: string; title: string }>
): {
  data: {
    name: string;
    works: Array<{ key: string; title: string }>;
    work_count: number;
  };
  status: number;
} {
  return {
    data: {
      name: 'science_fiction',
      works,
      work_count: works.length,
    },
    status: 200,
  };
}

describe('OpenLibrarySimilarClient', () => {
  let mockAxiosGet: jest.Mock;
  let mockAxiosInstance: AxiosInstance;
  let client: OpenLibrarySimilarClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet = jest.fn();
    mockAxiosInstance = { get: mockAxiosGet } as unknown as AxiosInstance;
    client = new OpenLibrarySimilarClient(mockAxiosInstance);
  });

  // ---------------------------------------------------------------------------
  // /works/ prefix stripping
  // ---------------------------------------------------------------------------

  describe('/works/ prefix stripping', () => {
    test('strips /works/ prefix when workId is in full-path format', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Science fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL82563W');

      // First call should be to /works/OL82563W.json (not /works//works/OL82563W.json)
      const firstCallUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(firstCallUrl).toBe('https://openlibrary.org/works/OL82563W.json');
      expect(firstCallUrl).not.toContain('/works//works/');
    });

    test('works correctly when workId is already a bare ID without /works/ prefix', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Mystery'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('OL12345W');

      const firstCallUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(firstCallUrl).toBe('https://openlibrary.org/works/OL12345W.json');
    });

    test('stripping is idempotent — bare IDs are not modified', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Adventure'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('OL99999W');

      const firstCallUrl = mockAxiosGet.mock.calls[0][0] as string;
      expect(firstCallUrl).toContain('OL99999W');
      expect(firstCallUrl).not.toContain('OL99999W/OL99999W');
    });
  });

  // ---------------------------------------------------------------------------
  // Subject fetch uses first subject
  // ---------------------------------------------------------------------------

  describe('subject selection', () => {
    test('uses the first subject from the work to build the subject URL', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({
            subjects: ['Science fiction', 'Space opera', 'Adventure'],
          })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL1W');

      // Second call should target the first subject (Science fiction → science_fiction)
      const secondCallUrl = mockAxiosGet.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('science_fiction');
      expect(secondCallUrl).not.toContain('space_opera');
    });

    test('normalizes subject to lowercase with underscores for spaces', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Historical Fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL2W');

      const secondCallUrl = mockAxiosGet.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('historical_fiction');
    });

    test('handles subject with multiple spaces correctly', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Young Adult Fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL3W');

      const secondCallUrl = mockAxiosGet.mock.calls[1][0] as string;
      expect(secondCallUrl).toContain('young_adult_fiction');
    });
  });

  // ---------------------------------------------------------------------------
  // externalRating is always null
  // ---------------------------------------------------------------------------

  describe('externalRating invariant', () => {
    test('all returned SimilarItems have externalRating: null', async () => {
      const works = [
        { key: '/works/OL100W', title: 'Book One' },
        { key: '/works/OL200W', title: 'Book Two' },
        { key: '/works/OL300W', title: 'Book Three' },
      ];
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse(works));

      const results = await client.fetchSimilar('/works/OL999W');

      expect(results).toHaveLength(3);
      for (const item of results) {
        expect(item.externalRating).toBeNull();
      }
    });

    test('externalRating is null even for a single result', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Drama'] })
        )
        .mockResolvedValueOnce(
          makeSubjectResponse([{ key: '/works/OL400W', title: 'A Drama' }])
        );

      const results = await client.fetchSimilar('/works/OL1W');

      expect(results[0].externalRating).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // No-subjects case — return [] and log WARN
  // ---------------------------------------------------------------------------

  describe('no subjects handling', () => {
    test('returns empty array when subjects field is undefined', async () => {
      mockAxiosGet.mockResolvedValueOnce(
        makeWorkDetailsResponse({}) // no subjects property
      );

      const results = await client.fetchSimilar('/works/OL500W');

      expect(results).toEqual([]);
    });

    test('returns empty array when subjects array is empty', async () => {
      mockAxiosGet.mockResolvedValueOnce(
        makeWorkDetailsResponse({ subjects: [] })
      );

      const results = await client.fetchSimilar('/works/OL600W');

      expect(results).toEqual([]);
    });

    test('logs WARN when work has no subjects', async () => {
      mockAxiosGet.mockResolvedValueOnce(
        makeWorkDetailsResponse({ subjects: [] })
      );

      await client.fetchSimilar('/works/OL700W');

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const warnMessage = (logger.warn as jest.Mock).mock.calls[0][0] as string;
      expect(warnMessage).toContain('/works/OL700W');
    });

    test('logs WARN with the original workId (full path) when no subjects', async () => {
      mockAxiosGet.mockResolvedValueOnce(
        makeWorkDetailsResponse({ subjects: undefined })
      );

      await client.fetchSimilar('/works/OL800W');

      const warnMessage = (logger.warn as jest.Mock).mock.calls[0][0] as string;
      expect(warnMessage).toContain('/works/OL800W');
    });

    test('does not make second API call when work has no subjects', async () => {
      mockAxiosGet.mockResolvedValueOnce(
        makeWorkDetailsResponse({ subjects: [] })
      );

      await client.fetchSimilar('/works/OL900W');

      // Only one call to the works endpoint — no subjects call
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // SimilarItem shape and mediaType
  // ---------------------------------------------------------------------------

  describe('SimilarItem mapping', () => {
    test('maps work to SimilarItem with mediaType book', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Classic literature'] })
        )
        .mockResolvedValueOnce(
          makeSubjectResponse([
            { key: '/works/OL1W', title: 'The Great Gatsby' },
          ])
        );

      const results = await client.fetchSimilar('/works/OL999W');

      const expected: SimilarItem = {
        externalId: '/works/OL1W',
        mediaType: 'book',
        title: 'The Great Gatsby',
        externalRating: null,
      };
      expect(results[0]).toEqual(expected);
    });

    test('externalId uses the full key path from the subject response', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Mystery'] })
        )
        .mockResolvedValueOnce(
          makeSubjectResponse([{ key: '/works/OL42W', title: 'Sherlock Holmes' }])
        );

      const results = await client.fetchSimilar('/works/OL1W');

      expect(results[0].externalId).toBe('/works/OL42W');
    });

    test('returns all items from subject response works array', async () => {
      const works = Array.from({ length: 15 }, (_, i) => ({
        key: `/works/OL${i + 1}W`,
        title: `Book ${i + 1}`,
      }));

      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Fantasy'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse(works));

      const results = await client.fetchSimilar('/works/OL99W');

      expect(results).toHaveLength(15);
    });

    test('returns empty array when subject has zero works', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Obscure topic'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      const results = await client.fetchSimilar('/works/OL1W');

      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // API error handling
  // ---------------------------------------------------------------------------

  describe('API error handling', () => {
    test('throws descriptive error when work details request fails', async () => {
      mockAxiosGet.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(client.fetchSimilar('/works/OL1W')).rejects.toThrow(
        /HTTP 404/
      );
    });

    test('error for work details request includes endpoint path', async () => {
      mockAxiosGet.mockRejectedValueOnce({ response: { status: 503 } });

      await expect(client.fetchSimilar('/works/OL1234W')).rejects.toThrow(
        /\/works\/OL1234W\.json/
      );
    });

    test('throws descriptive error when subject request fails', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Horror'] })
        )
        .mockRejectedValueOnce({ response: { status: 500 } });

      await expect(client.fetchSimilar('/works/OL1W')).rejects.toThrow(
        /HTTP 500/
      );
    });

    test('error for subject request includes subject path', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Horror'] })
        )
        .mockRejectedValueOnce({ response: { status: 503 } });

      await expect(client.fetchSimilar('/works/OL1W')).rejects.toThrow(
        /\/subjects\/horror\.json/
      );
    });

    test('throws with unknown status when response object is missing', async () => {
      mockAxiosGet.mockRejectedValueOnce(new Error('Network failure'));

      await expect(client.fetchSimilar('/works/OL1W')).rejects.toThrow(
        /HTTP unknown/
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Two-call sequence
  // ---------------------------------------------------------------------------

  describe('two-call sequence', () => {
    test('makes exactly two HTTP calls for a work with subjects', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Science fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL1W');

      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    test('first call is to the works details endpoint', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Science fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL55W');

      expect(mockAxiosGet.mock.calls[0][0]).toContain('/works/OL55W.json');
    });

    test('second call is to the subjects endpoint', async () => {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeWorkDetailsResponse({ subjects: ['Science fiction'] })
        )
        .mockResolvedValueOnce(makeSubjectResponse([]));

      await client.fetchSimilar('/works/OL55W');

      expect(mockAxiosGet.mock.calls[1][0]).toContain('/subjects/');
    });
  });
});
