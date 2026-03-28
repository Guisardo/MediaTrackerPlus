import axios from 'axios';

import {
  enrichParentalGuideFromImdb,
  parseImdbParentalGuideGraphqlResponse,
  parseImdbParentalGuideHtml,
} from 'src/metadata/provider/imdb';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('IMDb parental guide enrichment', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  test('parses non-spoiler and spoiler guide items from __NEXT_DATA__', () => {
    const result = parseImdbParentalGuideHtml(
      buildImdbParentalGuideHtml({
        categories: [
          buildSummaryCategory('NUDITY', 'Sex & Nudity', 'Moderate'),
          buildSummaryCategory('VIOLENCE', 'Violence & Gore', 'Severe'),
        ],
        nonSpoilerCategories: [
          buildGuideCategory('NUDITY', 'Sex & Nudity', [
            {
              isSpoiler: false,
              plaidHtml:
                'Rose&#39;s nude sketch includes <b>brief nudity</b>.',
            },
          ]),
        ],
        spoilerCategories: [
          buildGuideCategory('NUDITY', 'Sex & Nudity', [
            {
              isSpoiler: true,
              plaidHtml:
                'A later scene shows <i>blood</i> in the water after the sinking.',
            },
          ]),
          buildGuideCategory('VIOLENCE', 'Violence & Gore', [
            {
              isSpoiler: true,
              plaidHtml: 'Several passengers drown during the finale.',
            },
          ]),
        ],
      })
    );

    expect(result).toEqual({
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: [
        {
          category: 'Sex & Nudity',
          severity: 'Moderate',
          description: null,
          guideItems: [
            {
              text: "Rose's nude sketch includes brief nudity.",
              isSpoiler: false,
            },
            {
              text: 'A later scene shows blood in the water after the sinking.',
              isSpoiler: true,
            },
          ],
        },
        {
          category: 'Violence & Gore',
          severity: 'Severe',
          description: null,
          guideItems: [
            {
              text: 'Several passengers drown during the finale.',
              isSpoiler: true,
            },
          ],
        },
      ],
    });
  });

  test('returns null when the page payload does not contain parental guide data', () => {
    expect(parseImdbParentalGuideHtml('<html><body>empty</body></html>')).toBeNull();
  });

  test('parses guide items from IMDb GraphQL response', () => {
    const result = parseImdbParentalGuideGraphqlResponse(
      buildImdbParentalGuideGraphqlResponse()
    );

    expect(result).toEqual({
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: [
        {
          category: 'Sex & Nudity',
          severity: 'Moderate',
          description: null,
          guideItems: [
            {
              text: 'A steamed-up car window implies sex.',
              isSpoiler: false,
            },
            {
              text: 'A spoiler-tagged detail.',
              isSpoiler: true,
            },
          ],
        },
      ],
    });
  });

  test('returns unchanged media item when IMDb fetch fails', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('blocked'));
    mockedAxios.get.mockRejectedValueOnce(new Error('blocked'));

    const mediaItem = await enrichParentalGuideFromImdb({
      title: 'Titanic',
      mediaType: 'movie',
      source: 'tmdb',
      imdbId: 'tt0120338',
      parentalGuidanceCategories: null,
    });

    expect(mediaItem.parentalGuidanceCategories).toBeNull();
  });

  test('enriches media items with GraphQL guide items when IMDb responds', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: buildImdbParentalGuideGraphqlResponse(),
      status: 200,
    });

    const mediaItem = await enrichParentalGuideFromImdb({
      title: 'Titanic',
      mediaType: 'movie',
      source: 'tmdb',
      imdbId: 'tt0120338',
      parentalGuidanceCategories: null,
    });

    expect(mediaItem.parentalGuidanceCategories).toEqual([
      {
        category: 'Sex & Nudity',
        severity: 'Moderate',
        description: null,
        guideItems: [
          {
            text: 'A steamed-up car window implies sex.',
            isSpoiler: false,
          },
          {
            text: 'A spoiler-tagged detail.',
            isSpoiler: true,
          },
        ],
      },
    ]);
  });

  test('falls back to HTML parsing when GraphQL returns no categories', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          title: {
            parentsGuide: {
              categories: [],
            },
          },
        },
      },
      status: 200,
    });

    mockedAxios.get.mockResolvedValueOnce({
      data: buildImdbParentalGuideHtml({
        categories: [buildSummaryCategory('NUDITY', 'Sex & Nudity', 'Moderate')],
        nonSpoilerCategories: [
          buildGuideCategory('NUDITY', 'Sex & Nudity', [
            {
              isSpoiler: false,
              plaidHtml: 'A steamed-up car window implies sex.',
            },
          ]),
        ],
        spoilerCategories: [],
      }),
      status: 200,
    });

    const mediaItem = await enrichParentalGuideFromImdb({
      title: 'Titanic',
      mediaType: 'movie',
      source: 'tmdb',
      imdbId: 'tt0120338',
      parentalGuidanceCategories: null,
    });

    expect(mediaItem.parentalGuidanceCategories?.[0]?.guideItems?.[0]?.text).toBe(
      'A steamed-up car window implies sex.'
    );
  });
});

function buildImdbParentalGuideHtml(args: {
  categories: Array<Record<string, unknown>>;
  nonSpoilerCategories: Array<Record<string, unknown>>;
  spoilerCategories: Array<Record<string, unknown>>;
}) {
  const payload = {
    props: {
      pageProps: {
        contentData: {
          data: {
            title: {
              parentsGuide: {
                categories: args.categories,
                nonSpoilerCategories: args.nonSpoilerCategories,
                spoilerCategories: args.spoilerCategories,
              },
            },
          },
        },
      },
    },
  };

  return `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    payload
  )}</script></body></html>`;
}

function buildSummaryCategory(
  id: string,
  text: string,
  severity: string
) {
  return {
    category: {
      id,
      text,
    },
    severity: {
      text: severity,
    },
  };
}

function buildGuideCategory(
  id: string,
  text: string,
  items: Array<{ isSpoiler: boolean; plaidHtml: string }>
) {
  return {
    category: {
      id,
      text,
    },
    guideItems: {
      edges: items.map((item) => ({
        node: {
          isSpoiler: item.isSpoiler,
          text: {
            plaidHtml: item.plaidHtml,
          },
        },
      })),
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
                  {
                    node: {
                      isSpoiler: true,
                      text: {
                        plaidHtml: 'A spoiler-tagged detail.',
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
