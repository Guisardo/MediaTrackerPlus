import { MediaItemBase } from 'src/entity/mediaItem';
import { SimilarItem } from 'src/metadata/types';
import { RelatedContentService } from 'src/recommendations/relatedContentService';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const makeMediaItem = (overrides: Partial<MediaItemBase> = {}): MediaItemBase => ({
  id: 1,
  mediaType: 'movie',
  source: 'tmdb',
  title: 'Source Item',
  tmdbId: 100,
  ...overrides,
});

const makeSimilarItem = (
  mediaType: SimilarItem['mediaType'],
  externalId: string
): SimilarItem => ({
  mediaType,
  externalId,
  title: `${mediaType}:${externalId}`,
  externalRating: null,
});

describe('RelatedContentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('maps similar IDs to external IDs and preserves provider order', async () => {
    const similar = [
      makeSimilarItem('movie', '12'),
      makeSimilarItem('video_game', '33'),
      makeSimilarItem('book', '/works/OL1W'),
    ];

    const resolver = jest
      .fn()
      .mockResolvedValueOnce(
        makeMediaItem({
          id: 12,
          mediaType: 'movie',
          tmdbId: 12,
          title: 'Movie 12',
          posterId: 'poster-12',
        })
      )
      .mockResolvedValueOnce(
        makeMediaItem({
          id: 33,
          mediaType: 'video_game',
          igdbId: 33,
          source: 'IGDB',
          title: 'Game 33',
          posterId: 'poster-33',
        })
      )
      .mockResolvedValueOnce(
        makeMediaItem({
          id: 55,
          mediaType: 'book',
          openlibraryId: '/works/OL1W',
          source: 'OpenLibrary',
          title: 'Book 55',
        })
      );

    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockResolvedValue(similar),
      },
      findMediaItemByExternalId: resolver,
    });

    const result = await service.relatedContent({ mediaItem: makeMediaItem() });

    expect(resolver).toHaveBeenNthCalledWith(1, {
      id: { tmdbId: 12 },
      mediaType: 'movie',
    });
    expect(resolver).toHaveBeenNthCalledWith(2, {
      id: { igdbId: 33 },
      mediaType: 'video_game',
    });
    expect(resolver).toHaveBeenNthCalledWith(3, {
      id: { openlibraryId: '/works/OL1W' },
      mediaType: 'book',
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 12,
        posterSmall: '/img/poster-12?size=small',
      }),
      expect.objectContaining({
        id: 33,
        posterSmall: '/img/poster-33?size=small',
      }),
      expect.objectContaining({
        id: 55,
        posterSmall: null,
      }),
    ]);
  });

  test('dedupes by resolved mediaItem id and excludes source item', async () => {
    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockResolvedValue([
          makeSimilarItem('movie', '10'),
          makeSimilarItem('movie', '11'),
          makeSimilarItem('movie', '12'),
        ]),
      },
      findMediaItemByExternalId: jest
        .fn()
        .mockResolvedValueOnce(makeMediaItem({ id: 1, tmdbId: 10, title: 'Self' }))
        .mockResolvedValueOnce(makeMediaItem({ id: 7, tmdbId: 11, title: 'Duplicate #1' }))
        .mockResolvedValueOnce(makeMediaItem({ id: 7, tmdbId: 12, title: 'Duplicate #2' })),
    });

    const result = await service.relatedContent({
      mediaItem: makeMediaItem({ id: 1 }),
    });

    expect(result.map((item) => item.id)).toEqual([7]);
  });

  test('enforces the related-content cap', async () => {
    const similar = Array.from({ length: 20 }, (_, index) =>
      makeSimilarItem('movie', String(index + 2))
    );

    const resolver = jest.fn(async (args: { id: { tmdbId?: number } }) =>
      makeMediaItem({
        id: args.id.tmdbId,
        tmdbId: args.id.tmdbId,
        title: `Movie ${args.id.tmdbId}`,
      })
    );

    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockResolvedValue(similar),
      },
      findMediaItemByExternalId: resolver,
    });

    const result = await service.relatedContent({ mediaItem: makeMediaItem(), limit: 12 });

    expect(result).toHaveLength(12);
    expect(resolver).toHaveBeenCalledTimes(12);
  });

  test('filters out age-restricted related items', async () => {
    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockResolvedValue([
          makeSimilarItem('movie', '101'),
          makeSimilarItem('movie', '102'),
        ]),
      },
      findMediaItemByExternalId: jest
        .fn()
        .mockResolvedValueOnce(makeMediaItem({ id: 101, tmdbId: 101, title: 'Allowed', minimumAge: 13 }))
        .mockResolvedValueOnce(makeMediaItem({ id: 102, tmdbId: 102, title: 'Blocked', minimumAge: 18 })),
    });

    const result = await service.relatedContent({
      mediaItem: makeMediaItem(),
      viewerAge: 15,
    });

    expect(result.map((item) => item.id)).toEqual([101]);
  });

  test('skips unresolved candidates and candidate-level resolution errors', async () => {
    const resolutionError = new Error('resolution failed');
    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockResolvedValue([
          makeSimilarItem('movie', '201'),
          makeSimilarItem('movie', '202'),
          makeSimilarItem('movie', '203'),
        ]),
      },
      findMediaItemByExternalId: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(resolutionError)
        .mockResolvedValueOnce(makeMediaItem({ id: 203, tmdbId: 203, title: 'Resolved' })),
    });

    const result = await service.relatedContent({ mediaItem: makeMediaItem() });

    expect(result.map((item) => item.id)).toEqual([203]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to resolve similar item externalId="202"')
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RelatedContentService: related item resolution error',
      { err: resolutionError }
    );
  });

  test('returns empty when similarity provider fails', async () => {
    const similarError = new Error('similar failed');
    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockRejectedValue(similarError),
      },
      findMediaItemByExternalId: jest.fn(),
    });

    const result = await service.relatedContent({ mediaItem: makeMediaItem() });

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed to fetch similar items')
    );
    expect(logger.error).toHaveBeenCalledWith(
      'RelatedContentService: similarity fetch error',
      { err: similarError }
    );
  });

  test('does not expose a local poster URL when only an external poster exists', async () => {
    const service = new RelatedContentService({
      metadataProviders: {
        similar: jest.fn().mockResolvedValue([makeSimilarItem('movie', '301')]),
      },
      findMediaItemByExternalId: jest.fn().mockResolvedValue(
        makeMediaItem({
          id: 301,
          tmdbId: 301,
          title: 'External Poster Only',
          externalPosterUrl: 'https://image.tmdb.org/t/p/w500/example.jpg',
          posterId: null,
        })
      ),
    });

    const result = await service.relatedContent({ mediaItem: makeMediaItem() });

    expect(result).toEqual([
      expect.objectContaining({
        id: 301,
        posterSmall: null,
      }),
    ]);
  });
});
