/**
 * US-020: Sort order compatibility with active facets.
 *
 * Verifies that orderBy / sortOrder parameters produce correctly ordered results
 * even when facet filters (genres, languages, creators, yearMin/yearMax,
 * ratingMin/ratingMax, status, publishers, mediaTypes) are simultaneously active.
 *
 * These tests confirm the backend query layer — the frontend hook preservation of
 * orderBy/sortOrder is enforced by the merge strategy in useFacets and
 * useMultiValueSearchParam (verified by TypeScript typecheck + code review).
 */

import { mediaItemRepository } from 'src/repository/mediaItem';
import { MediaItemBase } from 'src/entity/mediaItem';
import { User } from 'src/entity/user';
import { userRepository } from 'src/repository/user';
import { clearDatabase, runMigrations } from '../../../__utils__/utils';
import { listItemRepository } from 'src/repository/listItemRepository';
import { seenRepository } from 'src/repository/seen';
import { userRatingRepository } from 'src/repository/userRating';

const user: User = {
  id: 1,
  name: 'user',
  password: 'password',
};

/** Action movie released 2010 — titleAlpha: A, rating 9.0 */
const movieA: MediaItemBase = {
  id: 1,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Alpha Movie',
  genres: ['Action', 'Sci-Fi'],
  language: 'en',
  director: 'Director One',
  tmdbRating: 9.0,
  releaseDate: '2010-07-16',
};

/** Action movie released 2019 — titleAlpha: B, rating 7.5 */
const movieB: MediaItemBase = {
  id: 2,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Beta Movie',
  genres: ['Action', 'Comedy'],
  language: 'fr',
  director: 'Director Two',
  tmdbRating: 7.5,
  releaseDate: '2019-01-15',
};

/** Drama TV show released 2015 — titleAlpha: C, rating 9.5 */
const tvShowC: MediaItemBase = {
  id: 3,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'user',
  title: 'Charlie Show',
  genres: ['Drama'],
  language: 'en',
  creator: 'Creator Person',
  tmdbRating: 9.5,
  releaseDate: '2015-03-10',
};

/** RPG video game released 2015 — titleAlpha: D, no rating */
const gameD: MediaItemBase = {
  id: 4,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'video_game',
  source: 'user',
  title: 'Delta Game',
  genres: ['RPG'],
  language: 'en',
  developer: 'Dev Studio',
  publisher: 'Pub House',
  tmdbRating: undefined,
  releaseDate: '2015-05-19',
};

describe('sortOrderWithFacets', () => {
  beforeAll(async () => {
    await runMigrations();
    await userRepository.create(user);
    await mediaItemRepository.createMany([movieA, movieB, tvShowC, gameD]);

    // Add all items to library (watchlist only for game; seen for rest)
    await listItemRepository.addItem({
      userId: user.id,
      watchlist: true,
      mediaItemId: movieA.id!,
    });
    await seenRepository.create({
      mediaItemId: movieA.id!,
      userId: user.id,
      date: new Date().getTime(),
    });

    await listItemRepository.addItem({
      userId: user.id,
      watchlist: true,
      mediaItemId: movieB.id!,
    });
    await seenRepository.create({
      mediaItemId: movieB.id!,
      userId: user.id,
      date: new Date().getTime(),
    });

    await listItemRepository.addItem({
      userId: user.id,
      watchlist: true,
      mediaItemId: tvShowC.id!,
    });
    await seenRepository.create({
      mediaItemId: tvShowC.id!,
      userId: user.id,
      date: new Date().getTime(),
    });

    await listItemRepository.addItem({
      userId: user.id,
      watchlist: true,
      mediaItemId: gameD.id!,
    });
    // gameD: watchlist only, not seen

    // Add rating for movieA to enable 'rated' status tests
    await userRatingRepository.create({
      id: 200,
      mediaItemId: movieA.id,
      userId: user.id,
      rating: 9,
      date: new Date().getTime(),
    });
  });

  afterAll(clearDatabase);

  describe('orderBy=title with active facets', () => {
    test('title asc with genre facet returns filtered items in alphabetical order', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        genres: 'Action',
      });

      // Only Action movies: Alpha Movie, Beta Movie
      expect(result.data.length).toStrictEqual(2);
      expect(result.data[0].title).toStrictEqual('Alpha Movie');
      expect(result.data[1].title).toStrictEqual('Beta Movie');
    });

    test('title desc with genre facet returns filtered items in reverse alphabetical order', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'desc',
        genres: 'Action',
      });

      expect(result.data.length).toStrictEqual(2);
      expect(result.data[0].title).toStrictEqual('Beta Movie');
      expect(result.data[1].title).toStrictEqual('Alpha Movie');
    });

    test('title asc with mediaTypes facet returns filtered items alphabetically', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        mediaTypes: 'movie,tv',
      });

      // Alpha Movie, Beta Movie, Charlie Show (no Delta Game)
      const titles = result.data.map((i) => i.title);
      expect(titles).toEqual(['Alpha Movie', 'Beta Movie', 'Charlie Show']);
    });
  });

  describe('orderBy=releaseDate with active facets', () => {
    test('releaseDate asc with genre facet returns filtered items oldest-first', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'releaseDate',
        sortOrder: 'asc',
        genres: 'Action',
      });

      // Action movies: Alpha (2010) before Beta (2019)
      expect(result.data.length).toStrictEqual(2);
      expect(result.data[0].title).toStrictEqual('Alpha Movie'); // 2010
      expect(result.data[1].title).toStrictEqual('Beta Movie'); // 2019
    });

    test('releaseDate desc with genre facet returns filtered items newest-first', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'releaseDate',
        sortOrder: 'desc',
        genres: 'Action',
      });

      expect(result.data[0].title).toStrictEqual('Beta Movie'); // 2019
      expect(result.data[1].title).toStrictEqual('Alpha Movie'); // 2010
    });

    test('releaseDate asc with yearMin facet returns items ordered by releaseDate within filtered range', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'releaseDate',
        sortOrder: 'asc',
        yearMin: 2015,
      });

      // Items from 2015+: Charlie Show (2015-03), Delta Game (2015-05), Beta Movie (2019)
      const titles = result.data.map((i) => i.title);
      expect(titles[0]).toStrictEqual('Charlie Show'); // 2015-03-10
      expect(titles[1]).toStrictEqual('Delta Game'); // 2015-05-19
      expect(titles[2]).toStrictEqual('Beta Movie'); // 2019-01-15
    });
  });

  describe('sort order preserved across multiple active facets', () => {
    test('title asc with language + genre facets combined returns correctly sorted subset', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        genres: 'Action',
        languages: 'en',
      });

      // Action + en: only Alpha Movie
      expect(result.data.length).toStrictEqual(1);
      expect(result.data[0].title).toStrictEqual('Alpha Movie');
    });

    test('title desc with mediaTypes + yearMin facets returns correctly sorted subset', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'desc',
        mediaTypes: 'movie',
        yearMin: 2015,
      });

      // Movies from 2015+: Beta Movie (2019) only (Alpha 2010 excluded)
      expect(result.data.length).toStrictEqual(1);
      expect(result.data[0].title).toStrictEqual('Beta Movie');
    });

    test('title asc with creators facet returns correctly sorted creator-filtered results', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        creators: 'Director One,Creator Person',
      });

      // Alpha Movie (Director One) + Charlie Show (Creator Person)
      expect(result.data.length).toStrictEqual(2);
      expect(result.data[0].title).toStrictEqual('Alpha Movie');
      expect(result.data[1].title).toStrictEqual('Charlie Show');
    });

    test('title asc with publishers facet returns correctly sorted publisher-filtered results', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        publishers: 'Pub House',
      });

      expect(result.data.length).toStrictEqual(1);
      expect(result.data[0].title).toStrictEqual('Delta Game');
    });

    test('title asc with ratingMin facet returns correctly sorted high-rated results', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        ratingMin: 9.0,
      });

      // Rating >= 9.0: Alpha Movie (9.0) + Charlie Show (9.5); Delta Game has no rating (excluded)
      const titles = result.data.map((i) => i.title);
      expect(titles).toContain('Alpha Movie');
      expect(titles).toContain('Charlie Show');
      expect(titles).not.toContain('Beta Movie'); // 7.5
      expect(titles).not.toContain('Delta Game'); // no rating
      // Sorted alphabetically asc
      expect(titles[0]).toStrictEqual('Alpha Movie');
      expect(titles[1]).toStrictEqual('Charlie Show');
    });

    test('title desc with status=watchlist facet returns correctly sorted watchlisted results', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'desc',
        status: 'watchlist',
      });

      // All 4 items are on watchlist, sorted title desc
      const titles = result.data.map((i) => i.title);
      expect(titles[0]).toStrictEqual('Delta Game');
      expect(titles[titles.length - 1]).toStrictEqual('Alpha Movie');
    });

    test('title asc with status=rated facet returns correctly sorted rated results', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        status: 'rated',
      });

      // Only movieA has a user rating
      expect(result.data.length).toStrictEqual(1);
      expect(result.data[0].title).toStrictEqual('Alpha Movie');
    });
  });

  describe('both sort directions work with any active facet', () => {
    test('asc and desc produce opposite orderings for same facet filter', async () => {
      const [ascResult, descResult] = await Promise.all([
        mediaItemRepository.items({
          userId: user.id,
          page: 1,
          orderBy: 'title',
          sortOrder: 'asc',
          mediaTypes: 'movie',
        }),
        mediaItemRepository.items({
          userId: user.id,
          page: 1,
          orderBy: 'title',
          sortOrder: 'desc',
          mediaTypes: 'movie',
        }),
      ]);

      const ascTitles = ascResult.data.map((i) => i.title);
      const descTitles = descResult.data.map((i) => i.title);

      // Same items but reversed
      expect(ascTitles).toEqual([...descTitles].reverse());
    });
  });

  describe('absent sort params do not interfere with facets', () => {
    test('facet filter without orderBy still returns correct items', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genres: 'Drama',
      });

      expect(items.length).toStrictEqual(1);
      expect(items[0].title).toStrictEqual('Charlie Show');
    });

    test('omitting facets with sort params still returns all items sorted', async () => {
      const result = await mediaItemRepository.items({
        userId: user.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
      });

      // All 4 items sorted title asc
      const titles = result.data.map((i) => i.title);
      expect(titles).toEqual([
        'Alpha Movie',
        'Beta Movie',
        'Charlie Show',
        'Delta Game',
      ]);
    });
  });
});
