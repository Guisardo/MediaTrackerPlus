import axios from 'axios';

import { TMDbMovie, TMDbTv } from 'src/metadata/provider/tmdb';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TMDb IMDb parental guide enrichment', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  test('enriches movie details with IMDb guide items', async () => {
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

      throw new Error(`Unexpected URL: ${url}`);
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: buildImdbParentalGuideGraphqlResponse(),
      status: 200,
    });

    const result = await new TMDbMovie().details({ tmdbId: 110 });

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

  test('enriches TV details with IMDb guide items', async () => {
    mockedAxios.get.mockImplementation(async (url: string) => {
      if (url.includes('/season/')) {
        return { data: buildSeasonResponse(1), status: 200 };
      }

      if (url.includes('api.themoviedb.org/3/tv/210')) {
        return {
          data: buildTvDetailsResponse({
            external_ids: {
              imdb_id: 'tt0903747',
            },
            content_ratings: {
              results: [{ iso_3166_1: 'US', rating: 'TV-MA' }],
            },
          }),
          status: 200,
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    mockedAxios.post.mockResolvedValueOnce({
      data: buildImdbParentalGuideGraphqlResponse(),
      status: 200,
    });

    const result = await new TMDbTv().details({ tmdbId: 210 });

    expect(result.contentRatingLabel).toBe('TV-MA');
    expect(result.parentalGuidanceCategories?.[0]?.guideItems?.[0]?.text).toBe(
      'A steamed-up car window implies sex.'
    );
  });
});

function buildMovieDetailsResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    adult: false,
    backdrop_path: '/testBackdrop.jpg',
    genres: [{ id: 28, name: 'Action' }],
    id: 100,
    imdb_id: 'tt0000001',
    original_language: 'en',
    original_title: 'Test Movie',
    overview: 'A test movie.',
    poster_path: '/testPoster.jpg',
    release_date: '2022-01-01',
    runtime: 90,
    status: 'Released',
    title: 'Test Movie',
    vote_average: 7.5,
    credits: { crew: [] },
    ...overrides,
  };
}

function buildTvDetailsResponse(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    adult: false,
    backdrop_path: '/testBackdrop.jpg',
    created_by: [],
    episode_run_time: [45],
    external_ids: {
      imdb_id: 'tt0000002',
      tvdb_id: 123,
    },
    first_air_date: '2020-01-01',
    genres: [{ id: 18, name: 'Drama' }],
    id: 210,
    name: 'Test Show',
    networks: [],
    number_of_episodes: 10,
    number_of_seasons: 1,
    origin_country: ['US'],
    original_language: 'en',
    original_name: 'Test Show',
    overview: 'A test show.',
    poster_path: '/testPoster.jpg',
    seasons: [
      {
        air_date: '2020-01-01',
        episode_count: 10,
        id: 401,
        name: 'Season 1',
        overview: 'Season overview',
        poster_path: '/seasonPoster.jpg',
        season_number: 1,
      },
    ],
    status: 'Returning Series',
    vote_average: 8.1,
    ...overrides,
  };
}

function buildSeasonResponse(seasonNumber: number): Record<string, unknown> {
  return {
    air_date: '2020-01-01',
    episodes: [],
    id: seasonNumber,
    name: `Season ${seasonNumber}`,
    overview: '',
    poster_path: '/seasonPoster.jpg',
    season_number: seasonNumber,
    external_ids: {
      tvdb_id: 9999,
    },
  };
}

function buildImdbParentalGuideGraphqlResponse() {
  return {
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
        },
      },
    },
  };
}
