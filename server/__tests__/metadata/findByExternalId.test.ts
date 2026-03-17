jest.mock('src/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('src/metadata/provider/tmdb', () => {
  const mockTMDbTv = {
    findByTmdbId: jest.fn(),
    findByImdbId: jest.fn(),
    findByTvdbId: jest.fn(),
    findByEpisodeImdbId: jest.fn(),
    findByEpisodeTvdbId: jest.fn(),
  };
  const mockTMDbMovie = {
    findByTmdbId: jest.fn(),
    findByImdbId: jest.fn(),
  };

  return {
    TMDbTv: jest.fn().mockImplementation(() => mockTMDbTv),
    TMDbMovie: jest.fn().mockImplementation(() => mockTMDbMovie),
    __mockTMDbMovie: mockTMDbMovie,
    __mockTMDbTv: mockTMDbTv,
  };
});

jest.mock('src/metadata/provider/audible', () => {
  const mockAudible = {
    findByAudibleId: jest.fn(),
  };

  return {
    Audible: jest.fn().mockImplementation(() => mockAudible),
    __mockAudible: mockAudible,
  };
});

jest.mock('src/metadata/provider/openlibrary', () => {
  const mockOpenLibrary = {
    details: jest.fn(),
  };

  return {
    OpenLibrary: jest.fn().mockImplementation(() => mockOpenLibrary),
    __mockOpenLibrary: mockOpenLibrary,
  };
});

jest.mock('src/repository/mediaItem', () => ({
  mediaItemRepository: {
    findByExternalId: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('src/repository/episode', () => ({
  tvEpisodeRepository: {
    findOne: jest.fn(),
  },
}));

jest.mock('src/updateMetadata', () => ({
  updateMediaItem: jest.fn(),
}));

import { findMediaItemByExternalIdInExternalSources } from 'src/metadata/findByExternalId';

const { logger: mockLogger } = jest.requireMock('src/logger') as {
  logger: {
    debug: jest.Mock;
    error: jest.Mock;
  };
};

const {
  __mockTMDbTv: mockTMDbTv,
  __mockTMDbMovie: mockTMDbMovie,
} = jest.requireMock('src/metadata/provider/tmdb') as {
  __mockTMDbTv: {
    findByTmdbId: jest.Mock;
    findByImdbId: jest.Mock;
    findByTvdbId: jest.Mock;
    findByEpisodeImdbId: jest.Mock;
    findByEpisodeTvdbId: jest.Mock;
  };
  __mockTMDbMovie: {
    findByTmdbId: jest.Mock;
    findByImdbId: jest.Mock;
  };
};

const { mediaItemRepository: mockMediaItemRepository } = jest.requireMock(
  'src/repository/mediaItem'
) as {
  mediaItemRepository: {
    findByExternalId: jest.Mock;
    create: jest.Mock;
  };
};

describe('findByExternalId external-source fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preserves TV provider precedence and falls back after a failed lookup', async () => {
    const providerItem = {
      title: 'Fallback Show',
      mediaType: 'tv' as const,
      source: 'tmdb',
      tmdbId: 101,
      imdbId: 'tt0101',
    };
    const createdItem = { id: 42, ...providerItem };

    mockTMDbTv.findByTmdbId.mockRejectedValueOnce(new Error('tmdb failure'));
    mockTMDbTv.findByImdbId.mockResolvedValueOnce(providerItem);
    mockMediaItemRepository.findByExternalId.mockResolvedValueOnce(undefined);
    mockMediaItemRepository.create.mockResolvedValueOnce(createdItem);

    const result = await findMediaItemByExternalIdInExternalSources({
      id: { tmdbId: 101, imdbId: 'tt0101', tvdbId: 555 },
      mediaType: 'tv',
    });

    expect(result).toEqual(createdItem);
    expect(mockTMDbTv.findByTmdbId).toHaveBeenCalledWith(101);
    expect(mockTMDbTv.findByImdbId).toHaveBeenCalledWith('tt0101');
    expect(mockTMDbTv.findByTvdbId).not.toHaveBeenCalled();
    expect(mockMediaItemRepository.findByExternalId).toHaveBeenCalledWith(
      providerItem,
      'tv'
    );
    expect(mockMediaItemRepository.create).toHaveBeenCalledWith(providerItem);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'unable to find tv show with tmdbId: 101'
    );
  });

  test('returns undefined when all movie lookups fail and does not create a record', async () => {
    mockTMDbMovie.findByTmdbId.mockResolvedValueOnce(undefined);
    mockTMDbMovie.findByImdbId.mockRejectedValueOnce(new Error('imdb failure'));

    const result = await findMediaItemByExternalIdInExternalSources({
      id: { tmdbId: 202, imdbId: 'tt0202' },
      mediaType: 'movie',
    });

    expect(result).toBeUndefined();
    expect(mockTMDbMovie.findByTmdbId).toHaveBeenCalledWith(202);
    expect(mockTMDbMovie.findByImdbId).toHaveBeenCalledWith('tt0202');
    expect(mockMediaItemRepository.findByExternalId).not.toHaveBeenCalled();
    expect(mockMediaItemRepository.create).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenNthCalledWith(
      1,
      'unable to find movie with tmdbId: 202'
    );
    expect(mockLogger.error).toHaveBeenNthCalledWith(
      2,
      'unable to find movie with imdbId: tt0202'
    );
  });
});
