jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('src/metadata/metadataProviders', () => ({
  metadataProviders: {
    trailers: jest.fn(),
    similar: jest.fn(),
  },
}));

jest.mock('src/metadata/findByExternalId', () => ({
  findMediaItemByExternalId: jest.fn(),
}));

jest.mock('src/repository/mediaItem', () => ({
  mediaItemRepository: {
    findOne: jest.fn(),
    details: jest.fn(),
  },
}));

jest.mock('src/repository/user', () => ({
  userRepository: {
    findOneSelf: jest.fn(),
  },
}));

jest.mock('src/updateMetadata', () => ({
  updateMediaItem: jest.fn(),
}));

import { request } from '__tests__/__utils__/request';
import { MediaItemController } from 'src/controllers/item';
import { logger } from 'src/logger';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { findMediaItemByExternalId } from 'src/metadata/findByExternalId';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { userRepository } from 'src/repository/user';
import { Config } from 'src/config';
import { _resetMetadataLanguagesCache } from 'src/metadataLanguages';
import { MediaItemDetailsResponse } from 'src/entity/mediaItem';

const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedMetadataProviders = metadataProviders as jest.Mocked<
  typeof metadataProviders
>;
const mockedFindMediaItemByExternalId =
  findMediaItemByExternalId as jest.MockedFunction<
    typeof findMediaItemByExternalId
  >;
const mockedMediaItemRepository = mediaItemRepository as jest.Mocked<
  typeof mediaItemRepository
>;
const mockedUserRepository = userRepository as jest.Mocked<typeof userRepository>;
const mutableConfig = Config as unknown as {
  METADATA_LANGUAGES: string[] | null;
};

const baseItem = {
  id: 77,
  title: 'Arrival',
  mediaType: 'movie',
  source: 'tmdb',
  tmdbId: 329865,
  minimumAge: null,
  posterId: 'abc',
};

const baseDetails = {
  ...baseItem,
  lists: [],
} as MediaItemDetailsResponse;

describe('MediaItemController related content enrichment', () => {
  const controller = new MediaItemController();
  const originalMetadataLanguages = Config.METADATA_LANGUAGES;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedMediaItemRepository.findOne.mockResolvedValue(baseItem as any);
    mockedMediaItemRepository.details.mockResolvedValue(baseDetails);
    mockedUserRepository.findOneSelf.mockResolvedValue({
      id: 1,
      dateOfBirth: '2010-01-01',
    } as any);
    mockedMetadataProviders.trailers.mockResolvedValue(null as never);
    mockedMetadataProviders.similar.mockResolvedValue([]);
    mockedFindMediaItemByExternalId.mockResolvedValue(undefined);
    mutableConfig.METADATA_LANGUAGES = ['en'];
    _resetMetadataLanguagesCache();
  });

  afterAll(() => {
    mutableConfig.METADATA_LANGUAGES = originalMetadataLanguages;
    _resetMetadataLanguagesCache();
  });

  afterEach(() => {
    mutableConfig.METADATA_LANGUAGES = originalMetadataLanguages;
    _resetMetadataLanguagesCache();
  });

  test('adds relatedContent with internal deep-link IDs when resolution succeeds', async () => {
    mockedMetadataProviders.similar.mockResolvedValue([
      {
        externalId: '1234',
        mediaType: 'movie',
        title: 'Another movie',
        externalRating: 8.1,
      },
    ]);
    mockedFindMediaItemByExternalId.mockResolvedValue({
      id: 1234,
      title: 'Another movie',
      mediaType: 'movie',
      source: 'tmdb',
      tmdbId: 1234,
      minimumAge: null,
      posterId: 'p1234',
    } as any);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'en' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as MediaItemDetailsResponse).relatedContent).toEqual([
      expect.objectContaining({
        id: 1234,
        title: 'Another movie',
        mediaType: 'movie',
        posterSmall: '/img/p1234?size=small',
      }),
    ]);
    expect(mockedFindMediaItemByExternalId).toHaveBeenCalledWith({
      id: { tmdbId: 1234 },
      mediaType: 'movie',
    });
  });

  test('omits relatedContent when similarity provider returns no candidates', async () => {
    mockedMetadataProviders.similar.mockResolvedValue([]);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'en' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as MediaItemDetailsResponse).relatedContent).toBeUndefined();
  });

  test('filters out related items blocked by viewer age', async () => {
    mockedMetadataProviders.similar.mockResolvedValue([
      {
        externalId: '2001',
        mediaType: 'movie',
        title: 'Allowed',
        externalRating: 7.0,
      },
      {
        externalId: '2002',
        mediaType: 'movie',
        title: 'Blocked',
        externalRating: 9.1,
      },
    ]);

    mockedFindMediaItemByExternalId
      .mockResolvedValueOnce({
        id: 2001,
        title: 'Allowed',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 2001,
        minimumAge: 13,
      } as any)
      .mockResolvedValueOnce({
        id: 2002,
        title: 'Blocked',
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: 2002,
        minimumAge: 18,
      } as any);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'en' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as MediaItemDetailsResponse).relatedContent).toEqual([
      expect.objectContaining({ id: 2001 }),
    ]);
  });

  test('logs and returns base details when related content fetching fails', async () => {
    const error = new Error('similar unavailable');
    mockedMetadataProviders.similar.mockRejectedValue(error);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'en' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as MediaItemDetailsResponse).relatedContent).toBeUndefined();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to fetch similar items')
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'RelatedContentService: similarity fetch error',
      { err: error }
    );
  });
});
