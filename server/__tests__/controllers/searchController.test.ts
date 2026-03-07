import { SearchController } from 'src/controllers/search';
import { Database } from 'src/dbconfig';
import { findMediaItemByExternalId } from 'src/metadata/findByExternalId';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

jest.mock('src/metadata/findByExternalId');

jest.mock('src/metadata/metadataProviders', () => ({
  metadataProviders: {
    has: jest.fn(),
    get: jest.fn(),
    details: jest.fn(),
  },
}));

const mockFindMediaItemByExternalId = findMediaItemByExternalId as jest.MockedFunction<
  typeof findMediaItemByExternalId
>;

const mockMetadataProviders = metadataProviders as {
  has: jest.Mock;
  get: jest.Mock;
  details: jest.Mock;
};

const movieWithImdbId = {
  id: 200,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'tmdb',
  title: 'The Dark Knight',
  imdbId: 'tt0468569',
  tmdbId: 468569,
};

const tvShowWithImdbId = {
  id: 201,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'tmdb',
  title: 'Breaking Bad',
  imdbId: 'tt0903747',
  tmdbId: 903747,
};

describe('Search controller', () => {
  beforeAll(async () => {
    await runMigrations();
    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);
    await Database.knex('mediaItem').insert(movieWithImdbId);
    await Database.knex('mediaItem').insert(tvShowWithImdbId);
  });

  afterAll(clearDatabase);

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns 400 for empty query', async () => {
    const searchController = new SearchController();

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: '   ', mediaType: 'movie' },
    });

    expect(res.statusCode).toBe(400);
  });

  test('IMDB ID search returns a matching movie from DB', async () => {
    const searchController = new SearchController();
    mockFindMediaItemByExternalId.mockResolvedValue(movieWithImdbId as any);

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'tt0468569', mediaType: 'movie' },
    });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as any[]).length).toBe(1);
    expect((res.data as any[])[0].id).toBe(movieWithImdbId.id);
    expect(mockFindMediaItemByExternalId).toHaveBeenCalledWith({
      id: { imdbId: 'tt0468569' },
      mediaType: 'movie',
    });
  });

  test('IMDB ID search returns a matching TV show from DB', async () => {
    const searchController = new SearchController();
    mockFindMediaItemByExternalId.mockResolvedValue(tvShowWithImdbId as any);

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'tt0903747', mediaType: 'tv' },
    });

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect((res.data as any[]).length).toBe(1);
    expect((res.data as any[])[0].id).toBe(tvShowWithImdbId.id);
    expect(mockFindMediaItemByExternalId).toHaveBeenCalledWith({
      id: { imdbId: 'tt0903747' },
      mediaType: 'tv',
    });
  });

  test('IMDB ID with unsupported mediaType falls through to title search', async () => {
    const searchController = new SearchController();
    const mockSearch = jest.fn().mockResolvedValue([]);
    mockMetadataProviders.has.mockReturnValue(true);
    mockMetadataProviders.get.mockReturnValue({ search: mockSearch });

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'tt0468569', mediaType: 'book' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith('tt0468569');
    expect(mockFindMediaItemByExternalId).not.toHaveBeenCalled();
  });

  test('IMDB ID not found returns empty array', async () => {
    const searchController = new SearchController();
    mockFindMediaItemByExternalId.mockResolvedValue(undefined);

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'tt9999999', mediaType: 'movie' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.data).toEqual([]);
  });

  test('regular title search uses metadata provider', async () => {
    const searchController = new SearchController();
    const mockSearch = jest.fn().mockResolvedValue([]);
    mockMetadataProviders.has.mockReturnValue(true);
    mockMetadataProviders.get.mockReturnValue({ search: mockSearch });

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'inception', mediaType: 'movie' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith('inception');
    expect(mockFindMediaItemByExternalId).not.toHaveBeenCalled();
  });
});
