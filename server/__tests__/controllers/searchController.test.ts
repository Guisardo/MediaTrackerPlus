import { SearchController } from 'src/controllers/search';
import { Config } from 'src/config';
import { Database } from 'src/dbconfig';
import { findMediaItemByExternalId } from 'src/metadata/findByExternalId';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { _resetMetadataLanguagesCache } from 'src/metadataLanguages';
import { upsertMediaItemTranslation } from 'src/repository/translationRepository';
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

const mockMetadataProviders = metadataProviders as unknown as {
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

  afterEach(async () => {
    jest.resetAllMocks();
    await Database.knex('mediaItemTranslation').delete();
    (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = null;
    _resetMetadataLanguagesCache();
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

  test('IMDB search falls back from regional request to base locale before default', async () => {
    (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
      'en',
      'es',
    ];
    _resetMetadataLanguagesCache();

    await upsertMediaItemTranslation(movieWithImdbId.id, 'en', {
      title: 'The Dark Knight (English)',
      overview: 'English overview',
      genres: ['Action'],
    });
    await upsertMediaItemTranslation(movieWithImdbId.id, 'es', {
      title: 'El caballero oscuro',
      overview: 'Resumen en espanol',
      genres: ['Accion'],
    });

    const searchController = new SearchController();
    mockFindMediaItemByExternalId.mockResolvedValue(movieWithImdbId as any);

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'tt0468569', mediaType: 'movie' },
      requestHeaders: { 'accept-language': 'es-AR' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as any[])[0].title).toBe('El caballero oscuro');
    expect((res.data as any[])[0].metadataLanguage).toBe('es');
  });

  test('IMDB search falls back to default locale when regional and base locales are unavailable', async () => {
    (Config as unknown as { METADATA_LANGUAGES: string[] | null }).METADATA_LANGUAGES = [
      'en',
      'fr',
    ];
    _resetMetadataLanguagesCache();

    await upsertMediaItemTranslation(movieWithImdbId.id, 'en', {
      title: 'The Dark Knight (English)',
      overview: 'English overview',
      genres: ['Action'],
    });

    const searchController = new SearchController();
    mockFindMediaItemByExternalId.mockResolvedValue(movieWithImdbId as any);

    const res = await request(searchController.search, {
      userId: Data.user.id,
      requestQuery: { q: 'tt0468569', mediaType: 'movie' },
      requestHeaders: { 'accept-language': 'es-AR' },
    });

    expect(res.statusCode).toBe(200);
    expect((res.data as any[])[0].title).toBe('The Dark Knight (English)');
    expect((res.data as any[])[0].metadataLanguage).toBe('en');
  });
});
