jest.mock('axios');
jest.mock('src/repository/globalSettings', () => ({
  GlobalConfiguration: {
    configuration: { tmdbLang: 'en' },
  },
}));
jest.mock('src/config', () => ({
  Config: {
    TMDB_API_KEY: 'test-key',
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

import axios from 'axios';
import { TMDbMovie } from 'src/metadata/provider/tmdb';

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * TMDbMovie.localizedDetails tests.
 *
 * localizedDetails(ids, language) fetches movie metadata from the TMDB API
 * using a specific language parameter. It:
 *   - Calls GET /3/movie/{tmdbId} with the language parameter
 *   - Reuses the internal mapMovie() pipeline
 *   - Deletes originalTitle from the result (base details() is responsible for that)
 *   - Converts empty strings to null for title and overview
 *   - Converts empty genres arrays to null
 *
 * These tests mock axios at the module level and verify both the API call
 * parameters and the returned data transformations.
 */

const tmdbMovie = new TMDbMovie();

describe('TMDbMovie.localizedDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Helpers -- mock TMDB API response factories
  // ---------------------------------------------------------------------------

  /**
   * Builds a realistic partial TMDB MovieDetailsResponse suitable for
   * localizedDetails tests. Callers can override individual fields.
   */
  function buildTmdbMovieResponse(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      adult: false,
      backdrop_path: '/someBackdrop.jpg',
      budget: 100000000,
      genres: [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' },
      ],
      homepage: 'https://example.com/movie',
      id: 550,
      imdb_id: 'tt0137523',
      original_language: 'en',
      original_title: 'Fight Club',
      overview: 'A ticking-Loss bomb insomniac and a slippery soap salesman.',
      popularity: 61.416,
      poster_path: '/somePoster.jpg',
      production_companies: [],
      production_countries: [],
      release_date: '1999-10-15',
      revenue: 100853753,
      runtime: 139,
      spoken_languages: [],
      status: 'Released',
      tagline: 'Mischief. Mayhem. Soap.',
      title: 'Fight Club',
      video: false,
      vote_average: 8.4,
      vote_count: 26000,
      ...overrides,
    };
  }

  // ---------------------------------------------------------------------------
  // Correct API call
  // ---------------------------------------------------------------------------

  describe('API call parameters', () => {
    test('makes a GET request to /3/movie/{tmdbId} with the correct language parameter', async () => {
      const tmdbId = 550;
      const language = 'fr';

      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({ title: 'Fight Club' }),
        status: 200,
      });

      await tmdbMovie.localizedDetails({ tmdbId }, language);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `https://api.themoviedb.org/3/movie/${tmdbId}`,
        {
          params: {
            api_key: 'test-key',
            language: 'fr',
          },
        }
      );
    });

    test('passes the language parameter exactly as provided (BCP 47 with region subtag)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({ title: 'El Club de la Pelea' }),
        status: 200,
      });

      await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'es-419');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/movie/550',
        {
          params: {
            api_key: 'test-key',
            language: 'es-419',
          },
        }
      );
    });

    test('does NOT append "append_to_response" like the regular details() method', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse(),
        status: 200,
      });

      await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'de');

      const callArgs = mockedAxios.get.mock.calls[0];
      const params = callArgs[1]?.params;

      expect(params).not.toHaveProperty('append_to_response');
    });
  });

  // ---------------------------------------------------------------------------
  // Localized title, overview, and genres
  // ---------------------------------------------------------------------------

  describe('localized data extraction', () => {
    test('returns localized title, overview, and genres for a given language', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          title: 'El Club de la Pelea',
          overview: 'Un empleado de oficina insomne y un fabricante de jabon forman un club de lucha.',
          genres: [
            { id: 28, name: 'Accion' },
            { id: 18, name: 'Drama' },
          ],
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'es');

      expect(result!.title).toBe('El Club de la Pelea');
      expect(result!.overview).toBe(
        'Un empleado de oficina insomne y un fabricante de jabon forman un club de lucha.'
      );
      expect(result!.genres).toEqual(['Accion', 'Drama']);
    });

    test('returns the full mapped movie structure (source, mediaType, tmdbId, etc.)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          id: 671,
          title: "Harry Potter a l'ecole des sorciers",
          release_date: '2001-11-16',
          runtime: 152,
          vote_average: 7.9,
          imdb_id: 'tt0241527',
          status: 'Released',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 671 }, 'fr');

      expect(result!.source).toBe('tmdb');
      expect(result!.mediaType).toBe('movie');
      expect(result!.tmdbId).toBe(671);
      expect(result!.releaseDate).toBe('2001-11-16');
      expect(result!.runtime).toBe(152);
      expect(result!.tmdbRating).toBe(7.9);
      expect(result!.imdbId).toBe('tt0241527');
      expect(result!.status).toBe('Released');
    });
  });

  // ---------------------------------------------------------------------------
  // originalTitle removal
  // ---------------------------------------------------------------------------

  describe('originalTitle exclusion', () => {
    test('does NOT include originalTitle in the result', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          original_title: 'Fight Club',
          title: 'Le Club de Combat',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'fr');

      expect(result!).not.toHaveProperty('originalTitle');
    });

    test('originalTitle is deleted even when API returns a non-empty original_title', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          original_title: 'Der Untergang',
          title: 'La Chute',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 613 }, 'fr');

      // originalTitle must not be present in the returned object at all
      expect(Object.keys(result!)).not.toContain('originalTitle');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty string to null conversion -- title
  // ---------------------------------------------------------------------------

  describe('empty title to null conversion', () => {
    test('converts empty title string to null', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          title: '',
          overview: 'Some overview',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'xx');

      expect(result!.title).toBeNull();
    });

    test('preserves non-empty title as-is', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          title: 'Clube da Luta',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'pt');

      expect(result!.title).toBe('Clube da Luta');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty string to null conversion -- overview
  // ---------------------------------------------------------------------------

  describe('empty overview to null conversion', () => {
    test('converts empty overview string to null', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          title: 'Fight Club',
          overview: '',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'xx');

      expect(result!.overview).toBeNull();
    });

    test('preserves non-empty overview as-is', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          overview: 'Un insomniaque et un vendeur de savon creent un club de combat.',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'fr');

      expect(result!.overview).toBe(
        'Un insomniaque et un vendeur de savon creent un club de combat.'
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Empty genres to null conversion
  // ---------------------------------------------------------------------------

  describe('empty genres to null conversion', () => {
    test('converts empty genres array to null', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          genres: [],
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'xx');

      expect(result!.genres).toBeNull();
    });

    test('preserves non-empty genres array as-is', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          genres: [
            { id: 28, name: 'Azione' },
            { id: 18, name: 'Dramma' },
          ],
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'it');

      expect(result!.genres).toEqual(['Azione', 'Dramma']);
    });

    test('preserves undefined genres (when API returns no genres field)', async () => {
      const responseData = buildTmdbMovieResponse();
      delete responseData.genres;

      mockedAxios.get.mockResolvedValueOnce({
        data: responseData,
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'ko');

      // When genres are undefined from mapItem, the null conversion guard
      // (movie.genres != null) won't trigger, so genres stays undefined
      expect(result!.genres).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases: all fields empty simultaneously
  // ---------------------------------------------------------------------------

  describe('all localizable fields empty simultaneously', () => {
    test('converts all empty fields to null at once', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          title: '',
          overview: '',
          genres: [],
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'xx');

      expect(result!.title).toBeNull();
      expect(result!.overview).toBeNull();
      expect(result!.genres).toBeNull();
      // originalTitle should still be deleted
      expect(result!).not.toHaveProperty('originalTitle');
    });
  });

  // ---------------------------------------------------------------------------
  // Comparison with details() -- behavioral contract
  // ---------------------------------------------------------------------------

  describe('behavioral contract vs details()', () => {
    test('details() includes originalTitle while localizedDetails() does not', async () => {
      const apiResponse = buildTmdbMovieResponse({
        original_title: 'Fight Club',
        title: 'Fight Club',
        credits: {
          crew: [
            {
              department: 'Directing',
              job: 'Director',
              name: 'David Fincher',
            },
          ],
        },
      });

      // Call details()
      mockedAxios.get.mockResolvedValueOnce({
        data: apiResponse,
        status: 200,
      });
      const detailsResult = await tmdbMovie.details({ tmdbId: 550 });
      expect(detailsResult).toHaveProperty('originalTitle');
      expect(detailsResult.originalTitle).toBe('Fight Club');

      // Call localizedDetails()
      mockedAxios.get.mockResolvedValueOnce({
        data: apiResponse,
        status: 200,
      });
      const localizedResult = await tmdbMovie.localizedDetails(
        { tmdbId: 550 },
        'en'
      );
      expect(localizedResult).not.toHaveProperty('originalTitle');
    });
  });

  // ---------------------------------------------------------------------------
  // Poster and backdrop URL mapping
  // ---------------------------------------------------------------------------

  describe('poster and backdrop URL mapping', () => {
    test('maps poster_path and backdrop_path to full image URLs', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          poster_path: '/abc123.jpg',
          backdrop_path: '/def456.jpg',
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'en');

      expect(result!.externalPosterUrl).toBe(
        'https://image.tmdb.org/t/p/original/abc123.jpg'
      );
      expect(result!.externalBackdropUrl).toBe(
        'https://image.tmdb.org/t/p/original/def456.jpg'
      );
    });

    test('maps null poster_path and backdrop_path to undefined', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbMovieResponse({
          poster_path: null,
          backdrop_path: null,
        }),
        status: 200,
      });

      const result = await tmdbMovie.localizedDetails({ tmdbId: 550 }, 'en');

      expect(result!.externalPosterUrl).toBeUndefined();
      expect(result!.externalBackdropUrl).toBeUndefined();
    });
  });
});
