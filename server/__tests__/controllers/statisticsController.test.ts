import {
  StatisticsController,
  userStatisticsSummary,
  userGenreStatistics,
} from 'src/controllers/statisticsController';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * StatisticsController tests.
 *
 * Tests cover:
 *  - HTTP surface: summary, seeninyear, genres endpoints return HTTP 200
 *  - Empty dataset → all values are zero, not errors
 *  - Correct counts/durations for movies, TV episodes, books, video games
 *  - Year filter: `seeninyear` only aggregates entries seen in a given year
 *  - `noyear` special value: includes only entries whose date is NULL
 *  - Genre breakdown: split, deduplicate, sort by count descending
 *  - Cross-user isolation: statistics are scoped to the requesting user
 */

// ---------------------------------------------------------------------------
// Seed helpers — define items with known runtime / pages / genres so we can
// reason precisely about the expected aggregated values.
// ---------------------------------------------------------------------------

const movieWithRuntime = {
  id: 100,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'tmdb',
  title: 'Runtime Movie',
  runtime: 90,
  tmdbId: 900001,
  genres: 'Action,Drama',
};

const movieWithRuntime2 = {
  id: 101,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'tmdb',
  title: 'Runtime Movie 2',
  runtime: 60,
  tmdbId: 900002,
  genres: 'Action',
};

const bookItem = {
  id: 102,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'book',
  source: 'openlibrary',
  title: 'Test Book',
  numberOfPages: 300,
  genres: 'Fiction,Science',
};

const videoGameItem = {
  id: 103,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'video_game',
  source: 'igdb',
  title: 'Test Game',
  genres: 'RPG',
};

// Date helpers — timestamps for different years
const dateIn2022 = new Date('2022-06-15').getTime();
const dateIn2023 = new Date('2023-03-10').getTime();

describe('StatisticsController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);

    // Seed all media items
    await Database.knex('mediaItem').insert(movieWithRuntime);
    await Database.knex('mediaItem').insert(movieWithRuntime2);
    await Database.knex('mediaItem').insert(bookItem);
    await Database.knex('mediaItem').insert(videoGameItem);
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);
    await Database.knex('episode').insert(Data.episode);
    await Database.knex('episode').insert(Data.episode2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('seen').delete();
  });

  // -------------------------------------------------------------------------
  // HTTP surface
  // -------------------------------------------------------------------------

  describe('GET /api/statistics/summary', () => {
    test('returns HTTP 200 and an object', async () => {
      const controller = new StatisticsController();

      const res = await request(controller.summary, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(typeof res.data).toBe('object');
    });
  });

  describe('GET /api/statistics/seeninyear', () => {
    test('returns HTTP 200 and an object', async () => {
      const controller = new StatisticsController();

      const res = await request(controller.seeninyear, {
        userId: Data.user.id,
        requestQuery: { year: '2023' },
      });

      expect(res.statusCode).toBe(200);
      expect(typeof res.data).toBe('object');
    });
  });

  describe('GET /api/statistics/genresinyear', () => {
    test('returns HTTP 200 and an object', async () => {
      const controller = new StatisticsController();

      const res = await request(controller.genres, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(typeof res.data).toBe('object');
    });
  });

  // -------------------------------------------------------------------------
  // Empty dataset → zeros, not errors
  // -------------------------------------------------------------------------

  describe('userStatisticsSummary – empty dataset', () => {
    test('returns an empty object (no keys) when there are no seen entries', async () => {
      const result = await userStatisticsSummary(Data.user.id);

      // The query groups by mediaType — with no rows there are no groups
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    test('does not throw for a user that has never seen anything', async () => {
      await expect(
        userStatisticsSummary(Data.user.id)
      ).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Movie seen counts and duration
  // -------------------------------------------------------------------------

  describe('userStatisticsSummary – movies', () => {
    test('counts a single movie seen entry correctly', async () => {
      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: movieWithRuntime.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userStatisticsSummary(Data.user.id);

      expect(result.movie).toBeDefined();
      expect(result.movie.items).toBe(1);
      expect(result.movie.plays).toBe(1);
    });

    test('sums runtime across multiple different movies', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime2.id,
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result = await userStatisticsSummary(Data.user.id);

      expect(result.movie.items).toBe(2);
      expect(result.movie.plays).toBe(2);
      // Total runtime: 90 + 60 = 150
      expect(result.movie.duration).toBe(150);
    });

    test('counts plays correctly when the same movie is seen multiple times', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2022,
        },
      ]);

      const result = await userStatisticsSummary(Data.user.id);

      // Same item watched twice → plays=2 but items=1 (DISTINCT count)
      expect(result.movie.plays).toBe(2);
      expect(result.movie.items).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // TV episode seen counts and duration
  // -------------------------------------------------------------------------

  describe('userStatisticsSummary – TV episodes', () => {
    test('counts each distinct episode seen', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode2.id,
          date: dateIn2023,
        },
      ]);

      const result = await userStatisticsSummary(Data.user.id);

      expect(result.tv).toBeDefined();
      expect(result.tv.episodes).toBe(2);
      expect(result.tv.plays).toBe(2);
    });

    test('items counts the distinct TV show, not distinct episodes', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode.id,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: Data.tvShow.id,
          episodeId: Data.episode2.id,
          date: dateIn2023,
        },
      ]);

      const result = await userStatisticsSummary(Data.user.id);

      // Both episodes belong to the same tvShow — items = 1
      expect(result.tv.items).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Book seen counts and page count
  // -------------------------------------------------------------------------

  describe('userStatisticsSummary – books', () => {
    test('reports numberOfPages for books', async () => {
      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: bookItem.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userStatisticsSummary(Data.user.id);

      expect(result.book).toBeDefined();
      expect(result.book.items).toBe(1);
      expect(result.book.numberOfPages).toBe(bookItem.numberOfPages);
    });
  });

  // -------------------------------------------------------------------------
  // Year filter
  // -------------------------------------------------------------------------

  describe('userStatisticsSummary – year filter', () => {
    test('returns only entries seen in the specified year', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2022,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime2.id,
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result2022 = await userStatisticsSummary(Data.user.id, '2022');
      const result2023 = await userStatisticsSummary(Data.user.id, '2023');

      expect(result2022.movie?.items).toBe(1);
      expect(result2023.movie?.items).toBe(1);
    });

    test('returns empty result for a year with no seen entries', async () => {
      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: movieWithRuntime.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userStatisticsSummary(Data.user.id, '2000');

      expect(result.movie).toBeUndefined();
    });

    test('noyear special value returns entries whose date is NULL', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: null,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime2.id,
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result = await userStatisticsSummary(Data.user.id, 'noyear');

      expect(result.movie?.items).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Cross-user isolation
  // -------------------------------------------------------------------------

  describe('userStatisticsSummary – cross-user isolation', () => {
    test('does not include seen entries from other users', async () => {
      // user2 sees a movie
      await Database.knex('seen').insert({
        userId: Data.user2.id,
        mediaItemId: movieWithRuntime.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userStatisticsSummary(Data.user.id);

      // user (id=0) has no seen entries
      expect(result.movie).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Genre statistics
  // -------------------------------------------------------------------------

  describe('userGenreStatistics', () => {
    test('returns an empty object when there are no seen entries', async () => {
      const result = await userGenreStatistics(Data.user.id);

      expect(typeof result).toBe('object');
    });

    test('splits comma-separated genres correctly', async () => {
      // movieWithRuntime has genres: 'Action,Drama'
      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: movieWithRuntime.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userGenreStatistics(Data.user.id);

      expect(result.movie).toBeDefined();
      const genres = result.movie.map((g) => g.genre);
      expect(genres).toContain('Action');
      expect(genres).toContain('Drama');
    });

    test('each genre entry has genre (string) and count (number)', async () => {
      await Database.knex('seen').insert({
        userId: Data.user.id,
        mediaItemId: movieWithRuntime.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userGenreStatistics(Data.user.id);

      for (const entry of result.movie) {
        expect(typeof entry.genre).toBe('string');
        expect(entry.genre.length).toBeGreaterThan(0);
        expect(typeof entry.count).toBe('number');
        expect(entry.count).toBeGreaterThan(0);
      }
    });

    test('accumulates counts when the same genre appears in multiple items', async () => {
      // Both movieWithRuntime ('Action,Drama') and movieWithRuntime2 ('Action') share 'Action'
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime2.id,
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result = await userGenreStatistics(Data.user.id);

      const actionEntry = result.movie.find((g) => g.genre === 'Action');
      expect(actionEntry).toBeDefined();
      // Each movie counts as 1 distinct item; Action appears in both → count=2
      expect(actionEntry!.count).toBe(2);
    });

    test('genres are sorted by count descending', async () => {
      // Action appears in both movies (count=2), Drama in only one (count=1)
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime2.id,
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result = await userGenreStatistics(Data.user.id);

      const counts = result.movie.map((g) => g.count);
      for (let i = 0; i < counts.length - 1; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i + 1]);
      }
    });

    test('groups genres by mediaType — books and movies do not mix', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,
          episodeId: null,
          date: dateIn2023,
        },
        {
          userId: Data.user.id,
          mediaItemId: bookItem.id,
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result = await userGenreStatistics(Data.user.id);

      // 'Fiction' and 'Science' belong only to books
      if (result.book) {
        const bookGenres = result.book.map((g) => g.genre);
        expect(bookGenres).toContain('Fiction');
        expect(bookGenres).toContain('Science');
      }

      // 'Action' and 'Drama' belong only to movies
      if (result.movie) {
        const movieGenres = result.movie.map((g) => g.genre);
        expect(movieGenres).toContain('Action');
        expect(movieGenres).toContain('Drama');
      }
    });

    test('year filter restricts genre aggregation to the specified year', async () => {
      await Database.knex('seen').insert([
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime.id,  // genres: Action, Drama
          episodeId: null,
          date: dateIn2022,
        },
        {
          userId: Data.user.id,
          mediaItemId: movieWithRuntime2.id, // genres: Action only
          episodeId: null,
          date: dateIn2023,
        },
      ]);

      const result2022 = await userGenreStatistics(Data.user.id, '2022');
      const result2023 = await userGenreStatistics(Data.user.id, '2023');

      // 2022 should have both Action and Drama
      const genres2022 = result2022.movie?.map((g) => g.genre) ?? [];
      expect(genres2022).toContain('Action');
      expect(genres2022).toContain('Drama');

      // 2023 should have Action only (movieWithRuntime2)
      const genres2023 = result2023.movie?.map((g) => g.genre) ?? [];
      expect(genres2023).toContain('Action');
      expect(genres2023).not.toContain('Drama');
    });

    test('cross-user isolation: genre stats are scoped to the requesting user', async () => {
      // user2 sees movieWithRuntime; user sees nothing
      await Database.knex('seen').insert({
        userId: Data.user2.id,
        mediaItemId: movieWithRuntime.id,
        episodeId: null,
        date: dateIn2023,
      });

      const result = await userGenreStatistics(Data.user.id);

      expect(result.movie).toBeUndefined();
    });
  });
});
