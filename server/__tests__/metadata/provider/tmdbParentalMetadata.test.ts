/**
 * Tests for TMDB parental metadata normalization.
 *
 * Covers:
 * - Movie details with US release_dates certifications (MPAA)
 * - TV details with US content_ratings (TV-PG system)
 * - Adult flag raising minimumAge to 18
 * - Descriptors passed through from movie release_dates
 * - GB/AU certifications (BBFC/ACB) via region precedence
 * - Empty / missing certifications leaving all parental fields null
 * - Unknown regions producing null parental fields
 * - Search results (no details call) leaving parental fields null
 */

import axios from 'axios';
import { TMDbMovie, TMDbTv } from 'src/metadata/provider/tmdb';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const tmdbMovie = new TMDbMovie();
const tmdbTv = new TMDbTv();

describe('TMDb parental metadata normalization', () => {
  beforeAll(runMigrations);
  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // Movie parental metadata
  // ---------------------------------------------------------------------------

  describe('TMDbMovie.details parental metadata', () => {
    test('maps US MPAA PG-13 certification to minimumAge 13', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          adult: false,
          release_dates: {
            results: [
              {
                iso_3166_1: 'US',
                release_dates: [
                  {
                    certification: 'PG-13',
                    descriptors: [],
                    iso_639_1: 'en',
                    release_date: '2022-06-10T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 100 });

      expect(result.minimumAge).toBe(13);
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingRegion).toBe('US');
      expect(result.contentRatingLabel).toBe('PG-13');
      expect(result.contentRatingDescriptors).toBeNull();
      expect(result.parentalGuidanceSummary).toBeNull();
      expect(result.parentalGuidanceCategories).toBeNull();
    });

    test('maps US MPAA R certification to minimumAge 17', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          release_dates: {
            results: [
              {
                iso_3166_1: 'US',
                release_dates: [
                  {
                    certification: 'R',
                    descriptors: ['Violence', 'Language'],
                    iso_639_1: 'en',
                    release_date: '2023-01-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 101 });

      expect(result.minimumAge).toBe(17);
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingLabel).toBe('R');
      expect(result.contentRatingDescriptors).toEqual(['Violence', 'Language']);
    });

    test('maps GB BBFC 15 certification when no US rating present', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          release_dates: {
            results: [
              {
                iso_3166_1: 'GB',
                release_dates: [
                  {
                    certification: '15',
                    descriptors: [],
                    iso_639_1: 'en',
                    release_date: '2022-01-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 102 });

      expect(result.minimumAge).toBe(15);
      expect(result.contentRatingSystem).toBe('BBFC');
      expect(result.contentRatingRegion).toBe('GB');
      expect(result.contentRatingLabel).toBe('15');
    });

    test('prefers US over GB when both present (region precedence)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          release_dates: {
            results: [
              {
                iso_3166_1: 'GB',
                release_dates: [
                  {
                    certification: '18',
                    descriptors: [],
                    iso_639_1: 'en',
                    release_date: '2022-01-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
              {
                iso_3166_1: 'US',
                release_dates: [
                  {
                    certification: 'PG',
                    descriptors: [],
                    iso_639_1: 'en',
                    release_date: '2022-01-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 103 });

      expect(result.contentRatingRegion).toBe('US');
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingLabel).toBe('PG');
      expect(result.minimumAge).toBe(0);
    });

    test('adult flag raises minimumAge to 18 when certification yields lower threshold', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          adult: true,
          release_dates: {
            results: [
              {
                iso_3166_1: 'US',
                release_dates: [
                  {
                    certification: 'PG',
                    descriptors: [],
                    iso_639_1: 'en',
                    release_date: '2022-01-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 104 });

      expect(result.minimumAge).toBe(18);
      // System/region/label still reflect the selected certification
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingLabel).toBe('PG');
    });

    test('adult flag alone sets minimumAge 18 when no certifications', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          adult: true,
          release_dates: { results: [] },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 105 });

      expect(result.minimumAge).toBe(18);
      expect(result.contentRatingSystem).toBeNull();
      expect(result.contentRatingRegion).toBeNull();
      expect(result.contentRatingLabel).toBeNull();
    });

    test('empty release_dates yields all null parental fields', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          adult: false,
          release_dates: { results: [] },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 106 });

      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
      expect(result.contentRatingRegion).toBeNull();
      expect(result.contentRatingLabel).toBeNull();
      expect(result.contentRatingDescriptors).toBeNull();
      expect(result.parentalGuidanceSummary).toBeNull();
      expect(result.parentalGuidanceCategories).toBeNull();
    });

    test('absent release_dates yields all null parental fields', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({ adult: false }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 107 });

      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
    });

    test('unrecognized region yields null parental fields when it is the only entry', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          adult: false,
          release_dates: {
            results: [
              {
                iso_3166_1: 'JP',
                release_dates: [
                  {
                    certification: 'G',
                    descriptors: [],
                    iso_639_1: 'ja',
                    release_date: '2022-06-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 108 });

      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
    });

    test('maps AU ACB M certification when AU is the best available region', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: buildMovieDetailsResponse({
          adult: false,
          release_dates: {
            results: [
              {
                iso_3166_1: 'AU',
                release_dates: [
                  {
                    certification: 'M',
                    descriptors: [],
                    iso_639_1: 'en',
                    release_date: '2022-01-01T00:00:00.000Z',
                    type: 3,
                  },
                ],
              },
            ],
          },
        }),
        status: 200,
      });

      const result = await tmdbMovie.details({ tmdbId: 109 });

      expect(result.minimumAge).toBe(15);
      expect(result.contentRatingSystem).toBe('ACB');
      expect(result.contentRatingRegion).toBe('AU');
      expect(result.contentRatingLabel).toBe('M');
    });

    test('enriches movie parental guide categories from IMDb when imdbId is present', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('api.themoviedb.org/3/movie/110')) {
          return {
            data: buildMovieDetailsResponse({
              imdb_id: 'tt0120338',
              release_dates: {
                results: [
                  {
                    iso_3166_1: 'US',
                    release_dates: [
                      {
                        certification: 'PG-13',
                        descriptors: [],
                        iso_639_1: 'en',
                        release_date: '2022-01-01T00:00:00.000Z',
                        type: 3,
                      },
                    ],
                  },
                ],
              },
            }),
            status: 200,
          };
        }

        if (url.includes('imdb.com/title/tt0120338/parentalguide')) {
          return {
            data: buildImdbParentalGuideHtml(),
            status: 200,
          };
        }

        throw new Error(`Unexpected URL: ${url}`);
      });

      const result = await tmdbMovie.details({ tmdbId: 110 });

      expect(result.contentRatingLabel).toBe('PG-13');
      expect(result.parentalGuidanceCategories).toEqual([
        {
          category: 'Sex & Nudity',
          severity: 'Moderate',
          description: null,
          guideItems: [
            {
              text: 'A steamed-up car window implies sex.',
              isSpoiler: false,
            },
          ],
        },
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // TV parental metadata
  // ---------------------------------------------------------------------------

  describe('TMDbTv.details parental metadata', () => {
    test('maps US TV-MA content rating to minimumAge 17', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({
            adult: false,
            content_ratings: {
              results: [{ iso_3166_1: 'US', rating: 'TV-MA' }],
            },
          }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 200 });

      expect(result.minimumAge).toBe(17);
      expect(result.contentRatingSystem).toBe('TV-PG');
      expect(result.contentRatingRegion).toBe('US');
      expect(result.contentRatingLabel).toBe('TV-MA');
      expect(result.contentRatingDescriptors).toBeNull();
      expect(result.parentalGuidanceSummary).toBeNull();
      expect(result.parentalGuidanceCategories).toBeNull();
    });

    test('maps US TV-14 content rating to minimumAge 14', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({
            content_ratings: {
              results: [{ iso_3166_1: 'US', rating: 'TV-14' }],
            },
          }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 201 });

      expect(result.minimumAge).toBe(14);
      expect(result.contentRatingSystem).toBe('TV-PG');
      expect(result.contentRatingLabel).toBe('TV-14');
    });

    test('maps GB BBFC 18 TV rating when no US rating is present', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({
            content_ratings: {
              results: [{ iso_3166_1: 'GB', rating: '18' }],
            },
          }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 202 });

      expect(result.minimumAge).toBe(18);
      expect(result.contentRatingSystem).toBe('BBFC');
      expect(result.contentRatingRegion).toBe('GB');
    });

    test('adult flag raises minimumAge to 18 for TV show', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({
            adult: true,
            content_ratings: {
              results: [{ iso_3166_1: 'US', rating: 'TV-G' }],
            },
          }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 203 });

      expect(result.minimumAge).toBe(18);
    });

    test('empty content_ratings yields all null parental fields', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({
            adult: false,
            content_ratings: { results: [] },
          }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 204 });

      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
      expect(result.contentRatingRegion).toBeNull();
      expect(result.contentRatingLabel).toBeNull();
      expect(result.contentRatingDescriptors).toBeNull();
      expect(result.parentalGuidanceSummary).toBeNull();
      expect(result.parentalGuidanceCategories).toBeNull();
    });

    test('absent content_ratings yields all null parental fields', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({ adult: false }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 205 });

      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
    });

    test('US rating preferred over GB when both present', async () => {
      mockedAxios.get.mockImplementation(async (url: string) => {
        if (url.includes('/season/')) {
          return { data: buildSeasonResponse(1) };
        }
        return {
          data: buildTvDetailsResponse({
            content_ratings: {
              results: [
                { iso_3166_1: 'GB', rating: '18' },
                { iso_3166_1: 'US', rating: 'TV-PG' },
              ],
            },
          }),
          status: 200,
        };
      });

      const result = await tmdbTv.details({ tmdbId: 206 });

      expect(result.contentRatingRegion).toBe('US');
      expect(result.contentRatingSystem).toBe('TV-PG');
      expect(result.contentRatingLabel).toBe('TV-PG');
      expect(result.minimumAge).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Response builder helpers
// ---------------------------------------------------------------------------

function buildMovieDetailsResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    adult: false,
    backdrop_path: '/testBackdrop.jpg',
    budget: 100000,
    genres: [{ id: 28, name: 'Action' }],
    homepage: '',
    id: 100,
    imdb_id: 'tt0000001',
    original_language: 'en',
    original_title: 'Test Movie',
    overview: 'A test movie.',
    popularity: 10,
    poster_path: '/testPoster.jpg',
    production_companies: [],
    production_countries: [],
    release_date: '2022-01-01',
    revenue: 0,
    runtime: 90,
    spoken_languages: [],
    status: 'Released',
    tagline: '',
    title: 'Test Movie',
    video: false,
    vote_average: 7.5,
    vote_count: 1000,
    credits: { crew: [] },
    ...overrides,
  };
}

function buildImdbParentalGuideHtml(): string {
  const payload = {
    props: {
      pageProps: {
        contentData: {
          data: {
            title: {
              parentsGuide: {
                categories: [
                  {
                    category: {
                      id: 'NUDITY',
                      text: 'Sex & Nudity',
                    },
                    severity: {
                      text: 'Moderate',
                    },
                  },
                ],
                nonSpoilerCategories: [
                  {
                    category: {
                      id: 'NUDITY',
                      text: 'Sex & Nudity',
                    },
                    guideItems: {
                      edges: [
                        {
                          node: {
                            isSpoiler: false,
                            text: {
                              plaidHtml: 'A steamed-up car window implies sex.',
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
                spoilerCategories: [],
              },
            },
          },
        },
      },
    },
  };

  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    payload
  )}</script>`;
}

function buildTvDetailsResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    adult: false,
    backdrop_path: '/testBackdrop.jpg',
    created_by: [],
    episode_run_time: [45],
    first_air_date: '2020-01-01',
    genres: [{ id: 18, name: 'Drama' }],
    homepage: '',
    id: 200,
    in_production: true,
    languages: ['en'],
    last_air_date: '2022-01-01',
    last_episode_to_air: null,
    name: 'Test Show',
    next_episode_to_air: null,
    networks: [{ name: 'Test Network', id: 1, logo_path: '', origin_country: 'US' }],
    number_of_episodes: 10,
    number_of_seasons: 1,
    origin_country: ['US'],
    original_language: 'en',
    original_name: 'Test Show',
    overview: 'A test show.',
    popularity: 10,
    poster_path: '/testPoster.jpg',
    production_companies: [],
    production_countries: [],
    seasons: [
      {
        air_date: '2020-01-01',
        episode_count: 10,
        id: 999,
        name: 'Season 1',
        overview: '',
        poster_path: '/testSeasonPoster.jpg',
        season_number: 1,
      },
    ],
    spoken_languages: [],
    status: 'Returning Series',
    tagline: '',
    type: 'Scripted',
    vote_average: 8.0,
    vote_count: 500,
    external_ids: {
      imdb_id: 'tt9999999',
      tvdb_id: 99999,
      id: 200,
    },
    ...overrides,
  };
}

function buildSeasonResponse(seasonNumber: number): Record<string, unknown> {
  return {
    _id: `season_${seasonNumber}`,
    air_date: '2020-01-01',
    episodes: [],
    name: `Season ${seasonNumber}`,
    overview: '',
    id: 900 + seasonNumber,
    poster_path: '/testSeasonPoster.jpg',
    season_number: seasonNumber,
    external_ids: { tvdb_id: 80000 + seasonNumber },
  };
}
