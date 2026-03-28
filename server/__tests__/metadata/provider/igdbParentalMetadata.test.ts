/**
 * Unit tests for IGDB parental metadata normalization.
 *
 * Tests cover:
 * - ESRB rating mapping (US)
 * - PEGI rating mapping (GB)
 * - Multiple concurrent ratings → strictest wins
 * - Content descriptors preserved from age_ratings
 * - No age_ratings → all parental fields null
 * - Unknown category or rating → skipped silently
 */

import axios from 'axios';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { IGDB } from 'src/metadata/provider/igdb';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const tokenRefreshMock = {
  status: 200,
  // expires_in=0 ensures token always re-fetches so each test needs 2 mocks.
  data: { access_token: 'test-token', expires_in: 0, token_type: 'bearer' },
};

const nullParentalFields = {
  minimumAge: null,
  contentRatingSystem: null,
  contentRatingRegion: null,
  contentRatingLabel: null,
  contentRatingDescriptors: null,
  parentalGuidanceSummary: null,
  parentalGuidanceCategories: null,
};

const buildGameResponse = (ageRatings?: unknown[]) => [
  {
    id: 19560,
    name: 'God of War',
    first_release_date: 1524182400,
    summary: 'Test summary',
    cover: { id: 1, image_id: 'co1tmu' },
    involved_companies: [],
    platforms: [],
    genres: [],
    websites: [{ id: 1, url: 'https://example.com' }],
    age_ratings: ageRatings,
  },
];

const mockDetailsCall = (ageRatings?: unknown[]) => {
  mockedAxios.post
    .mockResolvedValueOnce(tokenRefreshMock)
    .mockResolvedValueOnce({ status: 200, data: buildGameResponse(ageRatings) });
};

describe('IGDB parental metadata normalization', () => {
  let igdb: IGDB;

  beforeAll(runMigrations);
  afterAll(clearDatabase);
  beforeEach(() => {
    igdb = new IGDB();
    jest.clearAllMocks();
  });

  describe('ESRB ratings (category=1, region=US)', () => {
    test('ESRB T (Teen, rating=9) => minimumAge=13', async () => {
      mockDetailsCall([{ id: 1, category: 1, rating: 9 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 13,
        contentRatingSystem: 'ESRB',
        contentRatingRegion: 'US',
        contentRatingLabel: 'T',
        contentRatingDescriptors: null,
        parentalGuidanceSummary: null,
        parentalGuidanceCategories: null,
      });
    });

    test('ESRB M (Mature, rating=10) => minimumAge=17', async () => {
      mockDetailsCall([{ id: 1, category: 1, rating: 10 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 17,
        contentRatingSystem: 'ESRB',
        contentRatingRegion: 'US',
        contentRatingLabel: 'M',
      });
    });

    test('ESRB AO (Adults Only, rating=11) => minimumAge=18', async () => {
      mockDetailsCall([{ id: 1, category: 1, rating: 11 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 18,
        contentRatingSystem: 'ESRB',
        contentRatingLabel: 'AO',
      });
    });

    test('ESRB M with content_descriptions => descriptors preserved', async () => {
      mockDetailsCall([
        {
          id: 1,
          category: 1,
          rating: 10,
          content_descriptions: [
            { description: 'Blood and Gore' },
            { description: 'Intense Violence' },
          ],
        },
      ]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 17,
        contentRatingSystem: 'ESRB',
        contentRatingLabel: 'M',
        contentRatingDescriptors: ['Blood and Gore', 'Intense Violence'],
      });
    });

    test('ESRB E (Everyone, rating=7) => minimumAge=6', async () => {
      mockDetailsCall([{ id: 1, category: 1, rating: 7 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 6,
        contentRatingSystem: 'ESRB',
        contentRatingLabel: 'E',
      });
    });
  });

  describe('PEGI ratings (category=2, region=GB)', () => {
    test('PEGI 16 (rating=4) => minimumAge=16', async () => {
      mockDetailsCall([{ id: 1, category: 2, rating: 4 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 16,
        contentRatingSystem: 'PEGI',
        contentRatingRegion: 'GB',
        contentRatingLabel: '16',
      });
    });

    test('PEGI 18 (rating=5) => minimumAge=18', async () => {
      mockDetailsCall([{ id: 1, category: 2, rating: 5 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 18,
        contentRatingSystem: 'PEGI',
        contentRatingLabel: '18',
      });
    });
  });

  describe('Multiple ratings => strictest wins', () => {
    test('ESRB T (13) + PEGI 18 (18) => strictest is PEGI 18', async () => {
      mockDetailsCall([
        { id: 1, category: 1, rating: 9 },
        { id: 2, category: 2, rating: 5 },
      ]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 18,
        contentRatingSystem: 'PEGI',
        contentRatingLabel: '18',
      });
    });

    test('PEGI 12 (12) + ESRB M (17) => strictest is ESRB M', async () => {
      mockDetailsCall([
        { id: 1, category: 2, rating: 3 },
        { id: 2, category: 1, rating: 10 },
      ]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject({
        minimumAge: 17,
        contentRatingSystem: 'ESRB',
        contentRatingLabel: 'M',
      });
    });
  });

  describe('No or unrecognized age_ratings => all parental fields null', () => {
    test('no age_ratings property => all parental fields null', async () => {
      mockDetailsCall(undefined);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject(nullParentalFields);
    });

    test('empty age_ratings array => all parental fields null', async () => {
      mockDetailsCall([]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject(nullParentalFields);
    });

    test('unknown category (category=99) => all parental fields null', async () => {
      mockDetailsCall([{ id: 1, category: 99, rating: 5 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject(nullParentalFields);
    });

    test('unknown rating within known category => all parental fields null', async () => {
      mockDetailsCall([{ id: 1, category: 1, rating: 999 }]);

      const res = await igdb.details({ igdbId: 19560 });

      expect(res).toMatchObject(nullParentalFields);
    });
  });
});
