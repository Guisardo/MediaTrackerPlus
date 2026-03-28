import axios from 'axios';

import {
  MediaItemForProvider,
  ParentalGuidanceCategory,
  ParentalGuidanceGuideItem,
} from 'src/entity/mediaItem';
import { logger } from 'src/logger';

type ImdbParentalGuideResult = Pick<
  MediaItemForProvider,
  'parentalGuidanceSummary' | 'parentalGuidanceCategories'
>;

type ImdbParentsGuideCategorySummary = {
  category?: {
    id?: string;
    text?: string;
  } | null;
  severity?: {
    text?: string;
  } | null;
};

type ImdbGuideItemsConnection = {
  edges?: Array<{
    node?: {
      isSpoiler?: boolean;
      text?: {
        plaidHtml?: string | null;
      } | null;
    } | null;
  }>;
} | null;

type ImdbParentsGuideCategoryDetails = {
  category?: {
    id?: string;
    text?: string;
  } | null;
  guideItems?: ImdbGuideItemsConnection;
};

type ImdbParentalGuidePayload = {
  props?: {
    pageProps?: {
      contentData?: {
        data?: {
          title?: {
            parentsGuide?: {
              categories?: ImdbParentsGuideCategorySummary[];
              nonSpoilerCategories?: ImdbParentsGuideCategoryDetails[];
              spoilerCategories?: ImdbParentsGuideCategoryDetails[];
            };
          };
        };
      };
    };
  };
};

type ImdbGraphqlParentsGuideResponse = {
  data?: {
    title?: {
      parentsGuide?: {
        categories?: Array<{
          category?: {
            id?: string;
            text?: string;
          } | null;
          severity?: {
            text?: string;
          } | null;
          guideItems?: ImdbGuideItemsConnection;
        }>;
      } | null;
    } | null;
  } | null;
};

const IMDB_PARENTAL_GUIDE_URL = (imdbId: string) =>
  `https://www.imdb.com/title/${imdbId}/parentalguide/`;

const IMDB_GRAPHQL_URL = 'https://api.graphql.imdb.com/';

const IMDB_PARENTAL_GUIDE_GRAPHQL_QUERY = `
  query TitleParentsGuide($id: ID!) {
    title(id: $id) {
      parentsGuide {
        categories {
          category {
            id
            text
          }
          severity {
            text
          }
          guideItems(first: 250) {
            edges {
              node {
                isSpoiler
                text {
                  plaidHtml
                }
              }
            }
          }
        }
      }
    }
  }
`;

const IMDB_HTML_HEADERS = {
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

const IMDB_GRAPHQL_HEADERS = {
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

const FALLBACK_CATEGORY_LABELS: Record<string, string> = {
  ALCOHOL: 'Alcohol, Drugs & Smoking',
  FRIGHTENING: 'Frightening & Intense Scenes',
  NUDITY: 'Sex & Nudity',
  PROFANITY: 'Profanity',
  VIOLENCE: 'Violence & Gore',
};

const extractNextDataJson = (html: string): string | null => {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );

  return match?.[1] ?? null;
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const normalizeGuideItemText = (
  value: string | null | undefined
): string | null => {
  if (!value) {
    return null;
  }

  const plainText = decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();

  return plainText === '' ? null : plainText;
};

const buildCategoryLabel = (
  categoryId: string | undefined,
  categoryText: string | undefined
): string | null => {
  if (categoryText?.trim()) {
    return categoryText.trim();
  }

  if (categoryId && FALLBACK_CATEGORY_LABELS[categoryId]) {
    return FALLBACK_CATEGORY_LABELS[categoryId];
  }

  return categoryId ?? null;
};

const buildGuideItems = (args: {
  guideItems?: ImdbGuideItemsConnection;
}): ParentalGuidanceGuideItem[] => {
  const guideItems: ParentalGuidanceGuideItem[] = [];

  for (const edge of args.guideItems?.edges ?? []) {
    const text = normalizeGuideItemText(edge?.node?.text?.plaidHtml);
    if (!text) {
      continue;
    }

    guideItems.push({
      text,
      isSpoiler: edge?.node?.isSpoiler ?? false,
    });
  }

  return guideItems;
};

const mergeParentalGuide = (
  mediaItem: MediaItemForProvider,
  parentalGuide: ImdbParentalGuideResult
): MediaItemForProvider => ({
  ...mediaItem,
  parentalGuidanceSummary:
    parentalGuide.parentalGuidanceSummary ??
    mediaItem.parentalGuidanceSummary ??
    null,
  parentalGuidanceCategories:
    parentalGuide.parentalGuidanceCategories ??
    mediaItem.parentalGuidanceCategories ??
    null,
});

const buildSummaryCategoryMap = (
  summaries: ImdbParentsGuideCategorySummary[]
): { orderedIds: string[]; categoryMap: Map<string, ParentalGuidanceCategory> } => {
  const orderedIds: string[] = [];
  const categoryMap = new Map<string, ParentalGuidanceCategory>();

  for (const summary of summaries) {
    const categoryId = summary.category?.id;
    const categoryLabel = buildCategoryLabel(
      summary.category?.id,
      summary.category?.text
    );
    if (!categoryId || !categoryLabel) {
      continue;
    }

    orderedIds.push(categoryId);
    categoryMap.set(categoryId, {
      category: categoryLabel,
      severity: summary.severity?.text ?? null,
      description: null,
      guideItems: null,
    });
  }

  return { orderedIds, categoryMap };
};

const mergeDetailCategoriesIntoMap = (
  orderedIds: string[],
  categoryMap: Map<string, ParentalGuidanceCategory>,
  detailCategories: ImdbParentsGuideCategoryDetails[]
): void => {
  for (const detailCategory of detailCategories) {
    const categoryId = detailCategory.category?.id;
    const categoryLabel = buildCategoryLabel(
      detailCategory.category?.id,
      detailCategory.category?.text
    );
    if (!categoryId || !categoryLabel) {
      continue;
    }

    if (!orderedIds.includes(categoryId)) {
      orderedIds.push(categoryId);
    }

    const existing = categoryMap.get(categoryId);
    const guideItems = buildGuideItems({
      guideItems: detailCategory.guideItems,
    });

    categoryMap.set(categoryId, {
      category: categoryLabel,
      severity: existing?.severity ?? null,
      description: null,
      guideItems:
        guideItems.length > 0
          ? [...(existing?.guideItems ?? []), ...guideItems]
          : existing?.guideItems ?? null,
    });
  }
};

const collectNonEmptyCategories = (
  orderedIds: string[],
  categoryMap: Map<string, ParentalGuidanceCategory>
): ParentalGuidanceCategory[] =>
  orderedIds
    .map((categoryId) => categoryMap.get(categoryId))
    .filter((category): category is ParentalGuidanceCategory => category != null)
    .filter(
      (category) =>
        category.severity != null ||
        category.description != null ||
        category.guideItems != null
    );

export const parseImdbParentalGuideHtml = (
  html: string
): ImdbParentalGuideResult | null => {
  const nextDataJson = extractNextDataJson(html);
  if (!nextDataJson) {
    return null;
  }

  let payload: ImdbParentalGuidePayload;

  try {
    payload = JSON.parse(nextDataJson) as ImdbParentalGuidePayload;
  } catch {
    return null;
  }

  const guide = payload.props?.pageProps?.contentData?.data?.title?.parentsGuide;
  if (!guide) {
    return null;
  }

  const { orderedIds, categoryMap } = buildSummaryCategoryMap(
    guide.categories ?? []
  );

  mergeDetailCategoriesIntoMap(orderedIds, categoryMap, [
    ...(guide.nonSpoilerCategories ?? []),
    ...(guide.spoilerCategories ?? []),
  ]);

  const categories = collectNonEmptyCategories(orderedIds, categoryMap);

  if (categories.length === 0) {
    return null;
  }

  return {
    parentalGuidanceSummary: null,
    parentalGuidanceCategories: categories,
  };
};

export const parseImdbParentalGuideGraphqlResponse = (
  payload: ImdbGraphqlParentsGuideResponse
): ImdbParentalGuideResult | null => {
  const categories = payload.data?.title?.parentsGuide?.categories ?? [];
  if (categories.length === 0) {
    return null;
  }

  const parsedCategories: ParentalGuidanceCategory[] = [];

  for (const category of categories) {
    const categoryLabel = buildCategoryLabel(
      category.category?.id,
      category.category?.text
    );

    if (!categoryLabel) {
      continue;
    }

    const guideItems = buildGuideItems({
      guideItems: category.guideItems,
    });

    const parsedCategory: ParentalGuidanceCategory = {
      category: categoryLabel,
      severity: category.severity?.text ?? null,
      description: null,
      guideItems: guideItems.length > 0 ? guideItems : null,
    };

    if (
      parsedCategory.severity != null ||
      parsedCategory.description != null ||
      parsedCategory.guideItems != null
    ) {
      parsedCategories.push(parsedCategory);
    }
  }

  if (parsedCategories.length === 0) {
    return null;
  }

  return {
    parentalGuidanceSummary: null,
    parentalGuidanceCategories: parsedCategories,
  };
};

const fetchImdbParentalGuideGraphql = async (
  imdbId: string
): Promise<ImdbParentalGuideResult | null> => {
  const response = await axios.post<ImdbGraphqlParentsGuideResponse>(
    IMDB_GRAPHQL_URL,
    {
      query: IMDB_PARENTAL_GUIDE_GRAPHQL_QUERY,
      variables: {
        id: imdbId,
      },
    },
    {
      headers: IMDB_GRAPHQL_HEADERS,
      responseType: 'json',
    }
  );

  return parseImdbParentalGuideGraphqlResponse(response.data);
};

const fetchImdbParentalGuideHtml = async (
  imdbId: string
): Promise<ImdbParentalGuideResult | null> => {
  const response = await axios.get<string>(IMDB_PARENTAL_GUIDE_URL(imdbId), {
    headers: IMDB_HTML_HEADERS,
    responseType: 'text',
  });

  return parseImdbParentalGuideHtml(response.data);
};

export const enrichParentalGuideFromImdb = async (
  mediaItem: MediaItemForProvider
): Promise<MediaItemForProvider> => {
  if (!mediaItem.imdbId) {
    return mediaItem;
  }

  let lastError: unknown;

  try {
    const parentalGuide = await fetchImdbParentalGuideGraphql(mediaItem.imdbId);
    if (parentalGuide) {
      return mergeParentalGuide(mediaItem, parentalGuide);
    }
  } catch (error) {
    lastError = error;
  }

  try {
    const parentalGuide = await fetchImdbParentalGuideHtml(mediaItem.imdbId);
    if (parentalGuide) {
      return mergeParentalGuide(mediaItem, parentalGuide);
    }
  } catch (error) {
    lastError = error;
  }

  if (lastError) {
    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    logger.warn(
      `Unable to enrich IMDb parental guide for ${mediaItem.imdbId}: ${message}`
    );
  }

  return mediaItem;
};
