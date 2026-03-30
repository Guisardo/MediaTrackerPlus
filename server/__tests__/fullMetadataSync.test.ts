jest.mock('src/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('src/repository/mediaItem', () => ({
  mediaItemRepository: {
    find: jest.fn(),
  },
}));

jest.mock('src/metadata/metadataProviders', () => ({
  metadataProviders: {
    get: jest.fn(),
  },
}));

jest.mock('src/updateMetadata', () => ({
  runLockedMetadataUpdate: jest.fn(),
}));

import { MediaItemBase } from 'src/entity/mediaItem';
import {
  getFullMetadataSyncCandidates,
  runFullMetadataSync,
} from 'src/fullMetadataSync';
import { logger } from 'src/logger';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { runLockedMetadataUpdate } from 'src/updateMetadata';

const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedMetadataProviders = metadataProviders as jest.Mocked<
  typeof metadataProviders
>;
const mockedMediaItemRepository = mediaItemRepository as jest.Mocked<
  typeof mediaItemRepository
>;
const mockedRunLockedMetadataUpdate = runLockedMetadataUpdate as jest.MockedFunction<
  typeof runLockedMetadataUpdate
>;

describe('fullMetadataSync', () => {
  const supportedMovie: MediaItemBase = {
    id: 1,
    title: 'Arrival',
    mediaType: 'movie',
    source: 'tmdb',
  };
  const supportedTv: MediaItemBase = {
    id: 2,
    title: 'Dark',
    mediaType: 'tv',
    source: 'tmdb',
  };
  const unsupportedMovie: MediaItemBase = {
    id: 3,
    title: 'Manual',
    mediaType: 'movie',
    source: 'manual',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns only items backed by a registered metadata provider', async () => {
    mockedMediaItemRepository.find.mockResolvedValue([
      supportedMovie,
      supportedTv,
      unsupportedMovie,
    ]);

    mockedMetadataProviders.get.mockImplementation((mediaType, source) => {
      if (
        (mediaType === 'movie' || mediaType === 'tv') &&
        source === 'tmdb'
      ) {
        return {} as never;
      }

      return undefined as never;
    });

    await expect(getFullMetadataSyncCandidates()).resolves.toEqual([
      supportedMovie,
      supportedTv,
    ]);
  });

  test('delegates to the shared locked updater with forceUpdate enabled', async () => {
    mockedRunLockedMetadataUpdate.mockImplementation(async (args) => {
      const mediaItems = await args.selectMediaItems();

      expect(args.forceUpdate).toBe(true);
      expect(mediaItems).toEqual([supportedMovie]);
    });

    mockedMediaItemRepository.find.mockResolvedValue([
      supportedMovie,
      unsupportedMovie,
    ]);
    mockedMetadataProviders.get.mockImplementation((mediaType, source) =>
      mediaType === 'movie' && source === 'tmdb'
        ? ({} as never)
        : (undefined as never)
    );

    await runFullMetadataSync();

    expect(mockedRunLockedMetadataUpdate).toHaveBeenCalledTimes(1);
    expect(mockedLogger.info).toHaveBeenCalledWith(
      'Selected 1 items for full metadata sync'
    );
  });
});
