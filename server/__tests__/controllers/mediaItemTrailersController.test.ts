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
  },
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
import { mediaItemRepository } from 'src/repository/mediaItem';
import { userRepository } from 'src/repository/user';
import { Config } from 'src/config';
import { _resetMetadataLanguagesCache } from 'src/metadataLanguages';
import { MediaItemDetailsResponse, MediaTrailer } from 'src/entity/mediaItem';

const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedMetadataProviders = metadataProviders as jest.Mocked<
  typeof metadataProviders
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
};

const baseDetails = {
  ...baseItem,
  lists: [],
} as MediaItemDetailsResponse;

const trailers: MediaTrailer[] = [
  {
    id: 'youtube:arrival-es',
    title: 'Trailer oficial',
    kind: 'trailer',
    language: 'es',
    isOfficial: true,
    provider: 'tmdb',
    embedUrl: 'https://www.youtube.com/embed/arrival-es',
    externalUrl: 'https://www.youtube.com/watch?v=arrival-es',
  },
  {
    id: 'youtube:arrival-en',
    title: 'Official trailer',
    kind: 'trailer',
    language: 'en',
    isOfficial: true,
    provider: 'tmdb',
    embedUrl: 'https://www.youtube.com/embed/arrival-en',
    externalUrl: 'https://www.youtube.com/watch?v=arrival-en',
  },
];

describe('MediaItemController trailer enrichment', () => {
  const controller = new MediaItemController();
  const originalMetadataLanguages = Config.METADATA_LANGUAGES;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedMediaItemRepository.findOne.mockResolvedValue(baseItem as any);
    mockedMediaItemRepository.details.mockResolvedValue(baseDetails);
    mockedUserRepository.findOneSelf.mockResolvedValue({
      id: 1,
      dateOfBirth: null,
    } as any);
    mockedMetadataProviders.trailers.mockResolvedValue(null as never);
    mutableConfig.METADATA_LANGUAGES = ['en', 'es'];
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

  test('adds ordered trailers when provider returns playable candidates', async () => {
    mockedMetadataProviders.trailers.mockResolvedValue(trailers);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'es-AR,es;q=0.9,en;q=0.8' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockedMediaItemRepository.details).toHaveBeenCalledWith({
      mediaItemId: 77,
      userId: 1,
      language: 'es',
    });
    expect(mockedMetadataProviders.trailers).toHaveBeenCalledWith(
      baseDetails,
      'es'
    );
    expect((res.data as MediaItemDetailsResponse).trailers).toEqual(trailers);
  });

  test('omits trailers when provider returns no playable candidates', async () => {
    mockedMetadataProviders.trailers.mockResolvedValue([]);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'es' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as MediaItemDetailsResponse).trailers).toBeUndefined();
  });

  test('logs and returns base details when trailer provider fails', async () => {
    const error = new Error('tmdb unavailable');
    mockedMetadataProviders.trailers.mockRejectedValue(error);

    const res = await request(controller.details, {
      userId: 1,
      pathParams: { mediaItemId: 77 },
      requestHeaders: { 'accept-language': 'es' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as MediaItemDetailsResponse).trailers).toBeUndefined();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to fetch trailers for mediaItemId=77')
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      'MediaItemController.details: trailer enrichment error',
      { err: error }
    );
  });
});
