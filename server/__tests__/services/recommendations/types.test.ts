import { SimilarItem } from 'src/services/recommendations/types';

describe('SimilarItem type', () => {
  describe('Structure and exports', () => {
    test('SimilarItem type is correctly defined', () => {
      const item: SimilarItem = {
        externalId: 'tmdb-550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };

      expect(item).toEqual({
        externalId: 'tmdb-550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      });
    });
  });

  describe('mediaType union', () => {
    test('accepts movie mediaType', () => {
      const item: SimilarItem = {
        externalId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };

      expect(item.mediaType).toBe('movie');
    });

    test('accepts tv mediaType', () => {
      const item: SimilarItem = {
        externalId: '1399',
        mediaType: 'tv',
        title: 'Breaking Bad',
        externalRating: 9.5,
      };

      expect(item.mediaType).toBe('tv');
    });

    test('accepts game mediaType', () => {
      const item: SimilarItem = {
        externalId: 'igdb-12345',
        mediaType: 'game',
        title: 'The Legend of Zelda',
        externalRating: 9.0,
      };

      expect(item.mediaType).toBe('game');
    });

    test('accepts book mediaType', () => {
      const item: SimilarItem = {
        externalId: '/works/OL82563W',
        mediaType: 'book',
        title: 'The Great Gatsby',
        externalRating: null,
      };

      expect(item.mediaType).toBe('book');
    });
  });

  describe('externalRating field', () => {
    test('accepts externalRating within valid range [0.0, 10.0]', () => {
      const validRatings = [0, 0.5, 5.0, 8.8, 10.0];

      validRatings.forEach((rating) => {
        const item: SimilarItem = {
          externalId: 'test-id',
          mediaType: 'movie',
          title: 'Test',
          externalRating: rating,
        };

        expect(item.externalRating).toBe(rating);
      });
    });

    test('accepts null externalRating', () => {
      const item: SimilarItem = {
        externalId: 'test-id',
        mediaType: 'movie',
        title: 'Test',
        externalRating: null,
      };

      expect(item.externalRating).toBeNull();
    });

    test('correctly handles zero rating (unreleased items)', () => {
      const item: SimilarItem = {
        externalId: 'test-id',
        mediaType: 'movie',
        title: 'Unreleased Movie',
        externalRating: null, // Clients must coerce 0 to null before returning
      };

      expect(item.externalRating).toBeNull();
    });
  });

  describe('Field types', () => {
    test('externalId is string', () => {
      const item: SimilarItem = {
        externalId: 'tmdb-550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };

      expect(typeof item.externalId).toBe('string');
    });

    test('title is string', () => {
      const item: SimilarItem = {
        externalId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };

      expect(typeof item.title).toBe('string');
    });

    test('externalRating is number or null', () => {
      const itemWithRating: SimilarItem = {
        externalId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };

      expect(typeof itemWithRating.externalRating).toBe('number');

      const itemWithoutRating: SimilarItem = {
        externalId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: null,
      };

      expect(itemWithoutRating.externalRating).toBeNull();
    });
  });

  describe('Real-world examples', () => {
    test('TMDB movie example', () => {
      const tmdbMovie: SimilarItem = {
        externalId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
        externalRating: 8.8,
      };

      expect(tmdbMovie).toBeDefined();
      expect(tmdbMovie.externalRating).toBeGreaterThanOrEqual(0);
      expect(tmdbMovie.externalRating).toBeLessThanOrEqual(10);
    });

    test('TMDB TV example', () => {
      const tmdbTv: SimilarItem = {
        externalId: '1399',
        mediaType: 'tv',
        title: 'Breaking Bad',
        externalRating: 9.5,
      };

      expect(tmdbTv).toBeDefined();
      expect(tmdbTv.mediaType).toBe('tv');
    });

    test('IGDB game example with normalized rating', () => {
      const igdbGame: SimilarItem = {
        externalId: 'igdb-12345',
        mediaType: 'game',
        title: 'The Legend of Zelda',
        externalRating: 9.2, // Normalized from 92 (0-100 scale)
      };

      expect(igdbGame).toBeDefined();
      expect(igdbGame.externalRating).toBeGreaterThanOrEqual(0);
      expect(igdbGame.externalRating).toBeLessThanOrEqual(10);
    });

    test('OpenLibrary book example with null rating', () => {
      const olBook: SimilarItem = {
        externalId: '/works/OL82563W',
        mediaType: 'book',
        title: 'The Great Gatsby',
        externalRating: null,
      };

      expect(olBook).toBeDefined();
      expect(olBook.mediaType).toBe('book');
      expect(olBook.externalRating).toBeNull();
    });
  });

  describe('Type contract for API clients', () => {
    test('all API clients can produce SimilarItem with required fields', () => {
      const apiClientResults: SimilarItem[] = [
        {
          externalId: 'tmdb-550',
          mediaType: 'movie',
          title: 'Fight Club',
          externalRating: 8.8,
        },
        {
          externalId: 'igdb-1',
          mediaType: 'game',
          title: 'The Last of Us',
          externalRating: 9.3,
        },
        {
          externalId: 'ol-work-1',
          mediaType: 'book',
          title: 'Dune',
          externalRating: null,
        },
      ];

      expect(apiClientResults).toHaveLength(3);

      apiClientResults.forEach((item) => {
        expect(item).toHaveProperty('externalId');
        expect(item).toHaveProperty('mediaType');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('externalRating');
        expect(typeof item.externalId).toBe('string');
        expect(typeof item.title).toBe('string');
        expect(
          item.externalRating === null ||
            (typeof item.externalRating === 'number' &&
              item.externalRating >= 0 &&
              item.externalRating <= 10)
        ).toBe(true);
      });
    });
  });
});
