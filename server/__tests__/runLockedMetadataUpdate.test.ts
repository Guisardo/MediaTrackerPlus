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
    unlockLockedMediaItems: jest.fn(),
    lock: jest.fn(),
    unlock: jest.fn(),
    update: jest.fn(),
    seasonsWithEpisodes: jest.fn(),
    itemsToPossiblyUpdate: jest.fn(),
  },
}));

jest.mock('src/repository/user', () => ({
  userRepository: {
    findNotificationRecipientsForMediaItem: jest.fn(),
  },
}));

jest.mock('src/notifications/notifications', () => ({
  Notifications: {
    send: jest.fn(),
  },
}));

jest.mock('src/metadata/metadataProviders', () => ({
  metadataProviders: {
    get: jest.fn(),
  },
}));

jest.mock('src/repository/translationRepository', () => ({
  upsertMediaItemTranslations: jest.fn(),
  upsertSeasonTranslations: jest.fn(),
  upsertEpisodeTranslations: jest.fn(),
}));

jest.mock('src/utils', () => ({
  durationToMilliseconds: jest.fn(() => 0),
  updateAsset: jest.fn(),
}));

import { LockError } from 'src/lock';
import { MediaItemBaseWithSeasons } from 'src/entity/mediaItem';
import { logger } from 'src/logger';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { userRepository } from 'src/repository/user';
import { runLockedMetadataUpdate, updateMediaItems } from 'src/updateMetadata';

const mockedMediaItemRepository = mediaItemRepository as jest.Mocked<
  typeof mediaItemRepository
>;
const mockedMetadataProviders = metadataProviders as jest.Mocked<
  typeof metadataProviders
>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
const mockedUserRepository = userRepository as jest.Mocked<
  typeof userRepository
>;

describe('runLockedMetadataUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMediaItemRepository.unlockLockedMediaItems.mockResolvedValue(
      0 as never
    );
    mockedUserRepository.findNotificationRecipientsForMediaItem.mockResolvedValue(
      [] as never
    );
  });

  test('unlocks stale media locks before selecting items', async () => {
    const selectMediaItems = jest.fn().mockResolvedValue([]);

    await runLockedMetadataUpdate({
      selectMediaItems,
    });

    expect(
      mockedMediaItemRepository.unlockLockedMediaItems
    ).toHaveBeenCalledTimes(1);
    expect(selectMediaItems).toHaveBeenCalledTimes(1);
  });

  test('rejects concurrent runs through the shared metadata lock', async () => {
    let releaseSelection!: () => void;
    const firstSelect = jest.fn(
      () =>
        new Promise<[]>((resolve) => {
          releaseSelection = () => resolve([]);
        })
    );

    const firstRun = runLockedMetadataUpdate({
      selectMediaItems: firstSelect,
    });
    await Promise.resolve();

    await expect(
      runLockedMetadataUpdate({
        selectMediaItems: jest.fn().mockResolvedValue([]),
      })
    ).rejects.toThrow(LockError);

    expect(firstSelect).toHaveBeenCalledTimes(1);
    releaseSelection();
    await firstRun;
  });

  test('skips provider 404s without counting them as failures', async () => {
    const mediaItem: MediaItemBaseWithSeasons = {
      id: 210,
      title: 'Back to the Future: The Musical',
      mediaType: 'movie',
      source: 'tmdb',
      tmdbId: 1622467,
      lastTimeUpdated: 123,
      externalPosterUrl:
        'https://image.tmdb.org/t/p/original/hPMDklY5ARh07gPLGz9CozdXsaC.jpg',
      externalBackdropUrl:
        'https://image.tmdb.org/t/p/original/sczOC1sDNeV4P7FIEbKi6WaOPYq.jpg',
      posterId: 'poster-id',
      backdropId: 'backdrop-id',
    };

    mockedMetadataProviders.get.mockReturnValue({
      details: jest.fn().mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 },
        toString: () => 'AxiosError: Request failed with status code 404',
      }),
    } as never);

    mockedMediaItemRepository.lock.mockResolvedValue(undefined as never);
    mockedMediaItemRepository.unlock.mockResolvedValue(undefined as never);
    mockedMediaItemRepository.update.mockImplementation(
      async (item) => item as never
    );

    await updateMediaItems({
      mediaItems: [mediaItem],
      forceUpdate: true,
    });

    expect(mockedMediaItemRepository.lock).toHaveBeenCalledWith(mediaItem.id);
    expect(mockedMediaItemRepository.unlock).toHaveBeenCalledWith(mediaItem.id);
    expect(mockedMediaItemRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mediaItem.id,
        title: mediaItem.title,
        lastTimeUpdated: expect.any(Number),
      })
    );
    expect(mockedLogger.warn).toHaveBeenCalledTimes(2);
    expect(
      mockedLogger.error.mock.calls.some(([message]) =>
        String(message).includes('Failed to update 1 item')
      )
    ).toBe(false);
  });

  test('fetches provider details with bounded concurrency', async () => {
    const mediaItems: MediaItemBaseWithSeasons[] = Array.from(
      { length: 10 },
      (_, index) => ({
        id: index + 1,
        title: `Movie ${index + 1}`,
        mediaType: 'movie',
        source: 'tmdb',
        tmdbId: index + 1000,
      })
    );

    let inFlight = 0;
    let maxInFlight = 0;

    mockedMetadataProviders.get.mockReturnValue({
      details: jest.fn(async (item: MediaItemBaseWithSeasons) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;

        return {
          mediaType: item.mediaType,
          source: item.source,
          title: item.title,
        };
      }),
    } as never);

    mockedMediaItemRepository.lock.mockResolvedValue(undefined as never);
    mockedMediaItemRepository.unlock.mockResolvedValue(undefined as never);
    mockedMediaItemRepository.update.mockImplementation(
      async (item) => item as never
    );

    await updateMediaItems({
      mediaItems,
      forceUpdate: true,
    });

    expect(maxInFlight).toBeLessThanOrEqual(4);
  });
});
