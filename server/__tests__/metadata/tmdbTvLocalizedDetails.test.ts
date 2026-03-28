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
import { TMDbTv } from 'src/metadata/provider/tmdb';
import { logger } from 'src/logger';

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * TMDbTv.localizedDetails tests.
 *
 * localizedDetails(ids, language) fetches TV show metadata from the TMDB API
 * using a specific language parameter. It:
 *   - Calls GET /3/tv/{tmdbId} with the language parameter for show-level data
 *   - Calls GET /3/tv/{tmdbId}/season/{seasonNumber} with the language parameter
 *     for each season to get episode titles/overviews
 *   - Reuses the internal mapTvShow() and mapEpisode() pipelines
 *   - Deletes originalTitle from the result
 *   - Converts empty strings to null for title, overview, genres, season
 *     title/description, and episode title/description
 *   - If a season-level API call fails, that season is skipped with an error
 *     log and processing continues
 */

const tmdbTv = new TMDbTv();

// ---------------------------------------------------------------------------
// Mock response factories
// ---------------------------------------------------------------------------

function buildTmdbTvResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    backdrop_path: '/tvBackdrop.jpg',
    created_by: [{ id: 1, credit_id: 'abc', name: 'Creator', gender: 2, profile_path: null }],
    episode_run_time: [45],
    first_air_date: '2020-01-15',
    genres: [
      { id: 18, name: 'Drama' },
      { id: 10765, name: 'Sci-Fi & Fantasy' },
    ],
    homepage: 'https://example.com/tvshow',
    id: 1399,
    in_production: true,
    languages: ['en'],
    last_air_date: '2023-05-28',
    last_episode_to_air: null,
    name: 'Test TV Show',
    next_episode_to_air: null,
    networks: [{ name: 'HBO', id: 49, logo_path: '/logo.png', origin_country: 'US' }],
    number_of_episodes: 20,
    number_of_seasons: 2,
    origin_country: ['US'],
    original_language: 'en',
    original_name: 'Test TV Show Original',
    overview: 'A great TV show about testing.',
    popularity: 100.5,
    poster_path: '/tvPoster.jpg',
    production_companies: [],
    production_countries: [],
    seasons: [
      {
        air_date: '2020-01-15',
        episode_count: 10,
        id: 3624,
        name: 'Season 1',
        overview: 'The first season.',
        poster_path: '/s1poster.jpg',
        season_number: 1,
      },
      {
        air_date: '2021-03-20',
        episode_count: 10,
        id: 3625,
        name: 'Season 2',
        overview: 'The second season.',
        poster_path: '/s2poster.jpg',
        season_number: 2,
      },
    ],
    spoken_languages: [],
    status: 'Returning Series',
    tagline: 'Testing is coming.',
    type: 'Scripted',
    vote_average: 8.7,
    vote_count: 15000,
    external_ids: {
      imdb_id: 'tt0944947',
      tvdb_id: 121361,
    },
    ...overrides,
  };
}

function buildSeasonResponse(
  seasonNumber: number,
  episodes: Array<Record<string, unknown>> = [],
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    _id: `season-${seasonNumber}`,
    air_date: '2020-01-15',
    episodes: episodes,
    name: `Season ${seasonNumber}`,
    overview: `Overview of season ${seasonNumber}`,
    id: 3624 + seasonNumber - 1,
    poster_path: `/s${seasonNumber}poster.jpg`,
    season_number: seasonNumber,
    external_ids: {
      tvdb_id: 50000 + seasonNumber,
    },
    ...overrides,
  };
}

function buildEpisode(
  episodeNumber: number,
  seasonNumber: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    air_date: '2020-01-15',
    episode_number: episodeNumber,
    crew: [],
    guest_stars: [],
    id: 1000 + episodeNumber,
    name: `Episode ${episodeNumber}`,
    overview: `Overview of episode ${episodeNumber}`,
    production_code: '',
    season_number: seasonNumber,
    still_path: null,
    vote_average: 8.0,
    vote_count: 100,
    ...overrides,
  };
}

/**
 * Sets up axios.get mocks for a standard 2-season TV show localizedDetails call:
 *   Call 1: GET /3/tv/{tmdbId} → TV show response
 *   Call 2: GET /3/tv/{tmdbId}/season/1 → Season 1 with episodes
 *   Call 3: GET /3/tv/{tmdbId}/season/2 → Season 2 with episodes
 */
function setupStandardMocks(
  tvOverrides: Record<string, unknown> = {},
  s1Episodes?: Array<Record<string, unknown>>,
  s2Episodes?: Array<Record<string, unknown>>
) {
  const defaultS1Episodes = [
    buildEpisode(1, 1),
    buildEpisode(2, 1),
  ];
  const defaultS2Episodes = [
    buildEpisode(1, 2),
    buildEpisode(2, 2),
  ];

  mockedAxios.get
    .mockResolvedValueOnce({
      data: buildTmdbTvResponse(tvOverrides),
      status: 200,
    })
    .mockResolvedValueOnce({
      data: buildSeasonResponse(1, s1Episodes ?? defaultS1Episodes),
      status: 200,
    })
    .mockResolvedValueOnce({
      data: buildSeasonResponse(2, s2Episodes ?? defaultS2Episodes),
      status: 200,
    });
}

describe('TMDbTv.localizedDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // API call parameters
  // ---------------------------------------------------------------------------

  describe('API call parameters', () => {
    test('makes a GET request to /3/tv/{tmdbId} with the correct language parameter', async () => {
      setupStandardMocks();

      await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'fr');

      // First call: TV show details
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/tv/1399',
        {
          params: {
            api_key: 'test-key',
            language: 'fr',
          },
        }
      );
    });

    test('passes the language parameter to season API calls', async () => {
      setupStandardMocks();

      await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'es');

      // Second call: season 1
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/tv/1399/season/1',
        {
          params: {
            api_key: 'test-key',
            language: 'es',
          },
        }
      );

      // Third call: season 2
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.themoviedb.org/3/tv/1399/season/2',
        {
          params: {
            api_key: 'test-key',
            language: 'es',
          },
        }
      );
    });

    test('passes BCP 47 language tag as-is (e.g., es-419)', async () => {
      setupStandardMocks();

      await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'es-419');

      const firstCallParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(firstCallParams.language).toBe('es-419');

      const secondCallParams = mockedAxios.get.mock.calls[1][1]?.params;
      expect(secondCallParams.language).toBe('es-419');
    });

    test('does NOT append "append_to_response" or "external_ids" like details()', async () => {
      setupStandardMocks();

      await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'de');

      // Check TV show call
      const tvCallParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(tvCallParams).not.toHaveProperty('append_to_response');

      // Check season calls
      const s1CallParams = mockedAxios.get.mock.calls[1][1]?.params;
      expect(s1CallParams).not.toHaveProperty('append_to_response');
    });

    test('makes exactly 1 + N API calls (1 TV + N seasons)', async () => {
      setupStandardMocks();

      await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'fr');

      // 1 TV show call + 2 season calls = 3 total
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Localized data extraction
  // ---------------------------------------------------------------------------

  describe('localized show-level data', () => {
    test('returns localized title, overview, and genres for the show', async () => {
      setupStandardMocks({
        name: 'Programa de TV de Prueba',
        overview: 'Un gran programa de TV sobre pruebas.',
        genres: [
          { id: 18, name: 'Drama' },
          { id: 10765, name: 'Ciencia ficcion y fantasia' },
        ],
      });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'es');

      expect(result!.title).toBe('Programa de TV de Prueba');
      expect(result!.overview).toBe('Un gran programa de TV sobre pruebas.');
      expect(result!.genres).toEqual(['Drama', 'Ciencia ficcion y fantasia']);
    });

    test('returns the full mapped TV structure (source, mediaType, tmdbId, etc.)', async () => {
      setupStandardMocks();

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'en');

      expect(result!.source).toBe('tmdb');
      expect(result!.mediaType).toBe('tv');
      expect(result!.tmdbId).toBe(1399);
      expect(result!.releaseDate).toBe('2020-01-15');
      expect(result!.tmdbRating).toBe(8.7);
      expect(result!.status).toBe('Returning Series');
    });
  });

  // ---------------------------------------------------------------------------
  // Localized season and episode data
  // ---------------------------------------------------------------------------

  describe('localized season and episode data', () => {
    test('returns seasons with localized episodes from season API calls', async () => {
      const s1Episodes = [
        buildEpisode(1, 1, { name: 'Episodio Uno', overview: 'Resumen del episodio uno' }),
        buildEpisode(2, 1, { name: 'Episodio Dos', overview: 'Resumen del episodio dos' }),
      ];
      const s2Episodes = [
        buildEpisode(1, 2, { name: 'Episodio Tres', overview: 'Resumen del episodio tres' }),
      ];

      setupStandardMocks({}, s1Episodes, s2Episodes);

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'es');

      expect(result!.seasons).toHaveLength(2);

      // Season 1 episodes
      expect(result!.seasons![0]!.episodes).toHaveLength(2);
      expect(result!.seasons![0]!.episodes![0]!.title).toBe('Episodio Uno');
      expect(result!.seasons![0]!.episodes![0]!.description).toBe('Resumen del episodio uno');
      expect(result!.seasons![0]!.episodes![1]!.title).toBe('Episodio Dos');

      // Season 2 episodes
      expect(result!.seasons![1]!.episodes).toHaveLength(1);
      expect(result!.seasons![1]!.episodes![0]!.title).toBe('Episodio Tres');
    });

    test('episodes include correct episodeNumber and seasonNumber', async () => {
      const s1Episodes = [
        buildEpisode(1, 1, { name: 'E1' }),
        buildEpisode(2, 1, { name: 'E2' }),
      ];

      setupStandardMocks({}, s1Episodes);

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'es');

      const ep1 = result!.seasons![0]!.episodes![0]!;
      expect(ep1.episodeNumber).toBe(1);
      expect(ep1.seasonNumber).toBe(1);

      const ep2 = result!.seasons![0]!.episodes![1]!;
      expect(ep2.episodeNumber).toBe(2);
      expect(ep2.seasonNumber).toBe(1);
    });

    test('season data includes title, description, and seasonNumber from show-level response', async () => {
      setupStandardMocks({
        seasons: [
          {
            air_date: '2020-01-15',
            episode_count: 10,
            id: 3624,
            name: 'Temporada 1',
            overview: 'La primera temporada.',
            poster_path: '/s1poster.jpg',
            season_number: 1,
          },
        ],
      });

      // Only one season → only need 2 axios calls
      mockedAxios.get.mockReset();
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse({
            seasons: [
              {
                air_date: '2020-01-15',
                episode_count: 10,
                id: 3624,
                name: 'Temporada 1',
                overview: 'La primera temporada.',
                poster_path: '/s1poster.jpg',
                season_number: 1,
              },
            ],
          }),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, [buildEpisode(1, 1)]),
          status: 200,
        });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'es');

      expect(result!.seasons).toHaveLength(1);
      expect(result!.seasons![0]!.title).toBe('Temporada 1');
      expect(result!.seasons![0]!.description).toBe('La primera temporada.');
      expect(result!.seasons![0]!.seasonNumber).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // originalTitle exclusion
  // ---------------------------------------------------------------------------

  describe('originalTitle exclusion', () => {
    test('does NOT include originalTitle in the result', async () => {
      setupStandardMocks({
        original_name: 'Test TV Show Original',
        name: 'Programme TV de Test',
      });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'fr');

      expect(result!).not.toHaveProperty('originalTitle');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty string to null conversion — show level
  // ---------------------------------------------------------------------------

  describe('empty string to null conversion (show level)', () => {
    test('converts empty show title to null', async () => {
      setupStandardMocks({ name: '' });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.title).toBeNull();
    });

    test('converts empty show overview to null', async () => {
      setupStandardMocks({ overview: '' });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.overview).toBeNull();
    });

    test('converts empty genres array to null', async () => {
      setupStandardMocks({ genres: [] });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.genres).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Empty string to null conversion — season and episode level
  // ---------------------------------------------------------------------------

  describe('empty string to null conversion (season and episode level)', () => {
    test('converts empty season title to null', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse({
            seasons: [
              {
                air_date: '2020-01-15',
                episode_count: 1,
                id: 3624,
                name: '',
                overview: 'Valid overview',
                poster_path: null,
                season_number: 1,
              },
            ],
          }),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, [buildEpisode(1, 1)]),
          status: 200,
        });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.seasons![0]!.title).toBeNull();
    });

    test('converts empty season description to null', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse({
            seasons: [
              {
                air_date: '2020-01-15',
                episode_count: 1,
                id: 3624,
                name: 'Valid Name',
                overview: '',
                poster_path: null,
                season_number: 1,
              },
            ],
          }),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, [buildEpisode(1, 1)]),
          status: 200,
        });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.seasons![0]!.description).toBeNull();
    });

    test('converts empty episode title to null', async () => {
      const episodes = [buildEpisode(1, 1, { name: '' })];

      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse({
            seasons: [
              {
                air_date: '2020-01-15',
                episode_count: 1,
                id: 3624,
                name: 'Season 1',
                overview: 'Overview',
                poster_path: null,
                season_number: 1,
              },
            ],
          }),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, episodes),
          status: 200,
        });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.seasons![0]!.episodes![0]!.title).toBeNull();
    });

    test('converts empty episode description to null', async () => {
      const episodes = [buildEpisode(1, 1, { overview: '' })];

      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse({
            seasons: [
              {
                air_date: '2020-01-15',
                episode_count: 1,
                id: 3624,
                name: 'Season 1',
                overview: 'Overview',
                poster_path: null,
                season_number: 1,
              },
            ],
          }),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, episodes),
          status: 200,
        });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'xx');

      expect(result!.seasons![0]!.episodes![0]!.description).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Season-level API failure handling
  // ---------------------------------------------------------------------------

  describe('season-level API failure handling', () => {
    test('if a season API call fails, that season gets empty episodes and processing continues', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse(),
          status: 200,
        })
        // Season 1 fails
        .mockRejectedValueOnce(new Error('Network timeout'))
        // Season 2 succeeds
        .mockResolvedValueOnce({
          data: buildSeasonResponse(2, [
            buildEpisode(1, 2, { name: 'S2E1' }),
          ]),
          status: 200,
        });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'fr');

      // Season 1 should have empty episodes
      expect(result!.seasons![0]!.episodes).toEqual([]);

      // Season 2 should have its episode
      expect(result!.seasons![1]!.episodes).toHaveLength(1);
      expect(result!.seasons![1]!.episodes![0]!.title).toBe('S2E1');
    });

    test('logs an error when a season API call fails', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse({
            seasons: [
              {
                air_date: '2020-01-15',
                episode_count: 1,
                id: 3624,
                name: 'Season 1',
                overview: '',
                poster_path: null,
                season_number: 1,
              },
            ],
          }),
          status: 200,
        })
        .mockRejectedValueOnce(new Error('API rate limit'));

      await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'de');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('TMDbTv.localizedDetails: failed to fetch season 1'),
        expect.objectContaining({ err: expect.any(Error) })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Behavioral contract vs details()
  // ---------------------------------------------------------------------------

  describe('behavioral contract vs details()', () => {
    test('details() includes originalTitle while localizedDetails() does not', async () => {
      // Call details()
      // details() calls enrichParentalGuideFromImdb which:
      //   1. Makes a GraphQL POST to IMDB (mocked to return null data → no early return)
      //   2. Falls through to an HTML GET from IMDB (mocked to empty string → returns null)
      // Both are interleaved with the TMDB get mocks below, so the order must match
      // the actual call sequence: TMDB show → IMDB GraphQL POST → IMDB HTML GET → seasons.
      mockedAxios.post.mockResolvedValueOnce({ data: { data: null } });
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse(),
          status: 200,
        })
        .mockResolvedValueOnce({
          // IMDB HTML fallback: empty response → parseImdbParentalGuideHtml returns null
          data: '',
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, [buildEpisode(1, 1)]),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(2, [buildEpisode(1, 2)]),
          status: 200,
        });

      const detailsResult = await tmdbTv.details({ tmdbId: 1399 });
      expect(detailsResult).toHaveProperty('originalTitle');

      // Call localizedDetails()
      mockedAxios.get
        .mockResolvedValueOnce({
          data: buildTmdbTvResponse(),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(1, [buildEpisode(1, 1)]),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: buildSeasonResponse(2, [buildEpisode(1, 2)]),
          status: 200,
        });

      const localizedResult = await tmdbTv.localizedDetails(
        { tmdbId: 1399 },
        'en'
      );
      expect(localizedResult).not.toHaveProperty('originalTitle');
    });
  });

  // ---------------------------------------------------------------------------
  // TV show with no seasons
  // ---------------------------------------------------------------------------

  describe('TV show with no seasons', () => {
    test('handles a TV show with an empty seasons array', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildTmdbTvResponse({ seasons: [] }),
        status: 200,
      });

      const result = await tmdbTv.localizedDetails({ tmdbId: 1399 }, 'fr');

      expect(result!.seasons).toEqual([]);
      // Only 1 API call (no season calls)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });
});
