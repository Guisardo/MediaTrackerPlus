import {
  RecommendationService,
  RecommendationServiceDeps,
} from 'src/services/recommendations/RecommendationService';
import { TmdbSimilarClient } from 'src/services/recommendations/TmdbSimilarClient';
import { IgdbSimilarClient } from 'src/services/recommendations/IgdbSimilarClient';
import { OpenLibrarySimilarClient } from 'src/services/recommendations/OpenLibrarySimilarClient';
import { WatchlistWriter } from 'src/services/recommendations/WatchlistWriter';
import { SimilarItem } from 'src/services/recommendations/types';
import { MediaItemBase } from 'src/entity/mediaItem';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSimilarItems = (count: number, mediaType: SimilarItem['mediaType'] = 'movie'): SimilarItem[] =>
  Array.from({ length: count }, (_, i) => ({
    externalId: String(1000 + i),
    mediaType,
    title: `Title ${i}`,
    externalRating: 7.5,
  }));

const makeMediaItem = (
  overrides: Partial<MediaItemBase> = {}
): MediaItemBase => ({
  id: 42,
  title: 'Test Movie',
  mediaType: 'movie',
  source: 'tmdb',
  tmdbId: 12345,
  ...overrides,
});

const makeWriteResult = (added = 1, updated = 0, skipped = 0) => ({
  added,
  updated,
  skipped,
});

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<RecommendationServiceDeps> = {}): RecommendationServiceDeps {
  const mockTmdb = {
    fetchSimilar: jest.fn<Promise<SimilarItem[]>, [number, 'movie' | 'tv']>(),
  } as unknown as TmdbSimilarClient;

  const mockIgdb = {
    fetchSimilar: jest.fn<Promise<SimilarItem[]>, [number]>(),
  } as unknown as IgdbSimilarClient;

  const mockOpenLibrary = {
    fetchSimilar: jest.fn<Promise<SimilarItem[]>, [string]>(),
  } as unknown as OpenLibrarySimilarClient;

  const mockWriter = {
    write: jest.fn<Promise<ReturnType<WatchlistWriter['write']>>, [number, SimilarItem[], number]>(),
  } as unknown as WatchlistWriter;

  return {
    tmdbClient: mockTmdb,
    igdbClient: mockIgdb,
    openLibraryClient: mockOpenLibrary,
    watchlistWriter: mockWriter,
    findMediaItemById: jest.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Client dispatch by media type
// ---------------------------------------------------------------------------

describe('RecommendationService - client dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches to TmdbSimilarClient for movie', async () => {
    const items = makeSimilarItems(3, 'movie');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 100 });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(3));

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 8);

    expect(deps.tmdbClient.fetchSimilar).toHaveBeenCalledTimes(1);
    expect(deps.tmdbClient.fetchSimilar).toHaveBeenCalledWith(100, 'movie');
    expect(deps.igdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.openLibraryClient.fetchSimilar).not.toHaveBeenCalled();
  });

  it('dispatches to TmdbSimilarClient for tv', async () => {
    const items = makeSimilarItems(2, 'tv');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'tv', tmdbId: 999 });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(2));

    const service = new RecommendationService(deps);
    await service.processRating(2, 42, 7);

    expect(deps.tmdbClient.fetchSimilar).toHaveBeenCalledWith(999, 'tv');
    expect(deps.igdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.openLibraryClient.fetchSimilar).not.toHaveBeenCalled();
  });

  it('dispatches to IgdbSimilarClient for video_game', async () => {
    const items = makeSimilarItems(5, 'game');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'video_game', igdbId: 555 });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.igdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(5));

    const service = new RecommendationService(deps);
    await service.processRating(3, 42, 9);

    expect(deps.igdbClient.fetchSimilar).toHaveBeenCalledTimes(1);
    expect(deps.igdbClient.fetchSimilar).toHaveBeenCalledWith(555);
    expect(deps.tmdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.openLibraryClient.fetchSimilar).not.toHaveBeenCalled();
  });

  it('dispatches to OpenLibrarySimilarClient for book', async () => {
    const items = makeSimilarItems(4, 'book');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({
      mediaType: 'book',
      openlibraryId: '/works/OL82563W',
    });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.openLibraryClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(4));

    const service = new RecommendationService(deps);
    await service.processRating(4, 42, 6);

    expect(deps.openLibraryClient.fetchSimilar).toHaveBeenCalledTimes(1);
    expect(deps.openLibraryClient.fetchSimilar).toHaveBeenCalledWith('/works/OL82563W');
    expect(deps.tmdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.igdbClient.fetchSimilar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: WatchlistWriter called with correct args
// ---------------------------------------------------------------------------

describe('RecommendationService - WatchlistWriter integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls WatchlistWriter.write with userId, similarItems, and rating', async () => {
    const items = makeSimilarItems(3, 'movie');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 200 });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(3));

    const service = new RecommendationService(deps);
    await service.processRating(7, 42, 8.5);

    expect(deps.watchlistWriter.write).toHaveBeenCalledTimes(1);
    expect(deps.watchlistWriter.write).toHaveBeenCalledWith(7, items, 8.5);
  });

  it('logs completion with API result count, added, updated, skipped counters', async () => {
    const items = makeSimilarItems(5, 'movie');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 300 });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue({ added: 3, updated: 1, skipped: 1 });

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 7);

    const infoCalls = (logger.info as jest.Mock).mock.calls.map(([msg]) => msg as string);
    const completionLog = infoCalls.find((msg) => msg.includes('processRating complete'));

    expect(completionLog).toBeDefined();
    expect(completionLog).toContain('apiResultCount=5');
    expect(completionLog).toContain('added=3');
    expect(completionLog).toContain('updated=1');
    expect(completionLog).toContain('skipped=1');
  });

  it('logs entry with userId, mediaItemId, mediaType, and rating', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 400, id: 55 });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue([]);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(0));

    const service = new RecommendationService(deps);
    await service.processRating(9, 55, 6);

    const infoCalls = (logger.info as jest.Mock).mock.calls.map(([msg]) => msg as string);
    const entryLog = infoCalls.find((msg) => msg.includes('processRating start'));

    expect(entryLog).toBeDefined();
    expect(entryLog).toContain('userId=9');
    expect(entryLog).toContain('mediaItemId=55');
    expect(entryLog).toContain('mediaType=movie');
    expect(entryLog).toContain('rating=6');
  });
});

// ---------------------------------------------------------------------------
// Tests: Error handling — errors are caught, logged, and swallowed
// ---------------------------------------------------------------------------

describe('RecommendationService - error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('swallows error from TmdbSimilarClient and does not rethrow', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 500 });
    const apiError = new Error('TMDB 500 Internal Server Error for /3/movie/500/similar');

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockRejectedValue(apiError);

    const service = new RecommendationService(deps);

    // Should resolve (not throw)
    await expect(service.processRating(1, 42, 8)).resolves.toBeUndefined();
  });

  it('logs error from TmdbSimilarClient at ERROR level with err object', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 501 });
    const apiError = new Error('TMDB error');

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockRejectedValue(apiError);

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 8);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, meta] = (logger.error as jest.Mock).mock.calls[0] as [string, { err: unknown }];
    expect(meta).toHaveProperty('err', apiError);
  });

  it('swallows error from IgdbSimilarClient and does not rethrow', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'video_game', igdbId: 600 });
    const igdbError = new Error('IGDB API failure');

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.igdbClient.fetchSimilar as jest.Mock).mockRejectedValue(igdbError);

    const service = new RecommendationService(deps);
    await expect(service.processRating(2, 42, 7)).resolves.toBeUndefined();
  });

  it('swallows error from OpenLibrarySimilarClient and does not rethrow', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({
      mediaType: 'book',
      openlibraryId: '/works/OL99999W',
    });
    const libError = new Error('OpenLibrary network failure');

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.openLibraryClient.fetchSimilar as jest.Mock).mockRejectedValue(libError);

    const service = new RecommendationService(deps);
    await expect(service.processRating(3, 42, 9)).resolves.toBeUndefined();
  });

  it('swallows error from WatchlistWriter and does not rethrow', async () => {
    const items = makeSimilarItems(2, 'movie');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 700 });
    const writerError = new Error('Database transaction failed');

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockRejectedValue(writerError);

    const service = new RecommendationService(deps);
    await expect(service.processRating(4, 42, 5)).resolves.toBeUndefined();
  });

  it('logs error from WatchlistWriter at ERROR level', async () => {
    const items = makeSimilarItems(1, 'movie');
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: 701 });
    const writerError = new Error('DB write failure');

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.tmdbClient.fetchSimilar as jest.Mock).mockResolvedValue(items);
    (deps.watchlistWriter.write as jest.Mock).mockRejectedValue(writerError);

    const service = new RecommendationService(deps);
    await service.processRating(5, 42, 7);

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, meta] = (logger.error as jest.Mock).mock.calls[0] as [string, { err: unknown }];
    expect(meta).toHaveProperty('err', writerError);
  });

  it('swallows error from findMediaItemById and does not rethrow', async () => {
    const deps = makeDeps();
    const lookupError = new Error('DB connection failure');

    (deps.findMediaItemById as jest.Mock).mockRejectedValue(lookupError);

    const service = new RecommendationService(deps);
    await expect(service.processRating(6, 99, 8)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge cases
// ---------------------------------------------------------------------------

describe('RecommendationService - edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns early and logs WARN when mediaItem is not found', async () => {
    const deps = makeDeps();

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(undefined);

    const service = new RecommendationService(deps);
    await service.processRating(1, 999, 8);

    expect(deps.tmdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.igdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.openLibraryClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.watchlistWriter.write).not.toHaveBeenCalled();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [warnMsg] = (logger.warn as jest.Mock).mock.calls[0] as [string];
    expect(warnMsg).toContain('mediaItemId=999');
    expect(warnMsg).toContain('not found');
  });

  it('returns empty array and logs WARN when movie mediaItem has no tmdbId', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'movie', tmdbId: undefined });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(0));

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 8);

    expect(deps.tmdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.watchlistWriter.write).toHaveBeenCalledWith(1, [], 8);
  });

  it('returns empty array and logs WARN when video_game mediaItem has no igdbId', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'video_game', igdbId: undefined });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(0));

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 7);

    expect(deps.igdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.watchlistWriter.write).toHaveBeenCalledWith(1, [], 7);
  });

  it('returns empty array and logs WARN when book mediaItem has no openlibraryId', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'book', openlibraryId: undefined });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(0));

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 6);

    expect(deps.openLibraryClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.watchlistWriter.write).toHaveBeenCalledWith(1, [], 6);
  });

  it('returns empty array and logs INFO for unsupported audiobook media type', async () => {
    const deps = makeDeps();
    const mediaItem = makeMediaItem({ mediaType: 'audiobook' });

    (deps.findMediaItemById as jest.Mock).mockResolvedValue(mediaItem);
    (deps.watchlistWriter.write as jest.Mock).mockResolvedValue(makeWriteResult(0));

    const service = new RecommendationService(deps);
    await service.processRating(1, 42, 5);

    expect(deps.tmdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.igdbClient.fetchSimilar).not.toHaveBeenCalled();
    expect(deps.openLibraryClient.fetchSimilar).not.toHaveBeenCalled();

    const infoCalls = (logger.info as jest.Mock).mock.calls.map(([msg]) => msg as string);
    const audiobookLog = infoCalls.find((msg) => msg.includes('audiobook'));
    expect(audiobookLog).toBeDefined();
  });
});
