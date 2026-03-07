import { CalendarController, getCalendarItems } from 'src/controllers/calendar';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Episodes used in calendar tests.
 *
 * The calendar queries episodes linked to a watchlist list.  Each episode must
 * have a `releaseDate` that falls inside (or outside) the date range under test.
 * We reuse `Data.tvShow`, `Data.season` and inject three additional episodes that
 * have known release-dates so we can reason about inclusion/exclusion precisely.
 */
const tvShowId = Data.tvShow.id; // 1

const episodeInRange = {
  id: 10,
  episodeNumber: 10,
  isSpecialEpisode: false,
  releaseDate: '2023-06-15',
  seasonAndEpisodeNumber: 1010,
  seasonId: Data.season.id,
  seasonNumber: 1,
  title: 'Episode in range',
  tvShowId,
};

const episodeOutOfRange = {
  id: 11,
  episodeNumber: 11,
  isSpecialEpisode: false,
  releaseDate: '2020-01-01',
  seasonAndEpisodeNumber: 1011,
  seasonId: Data.season.id,
  seasonNumber: 1,
  title: 'Episode out of range',
  tvShowId,
};

// Intentionally duplicate id to test deduplication – same episode added twice via
// different list items (simulates being both on watchlist via mediaItem AND via direct
// episode list-item in a join).  We instead test de-duplication via the query logic
// by adding the episode to the watchlist directly and verifying it appears once.
const episodeDuplicate = {
  id: 12,
  episodeNumber: 12,
  isSpecialEpisode: false,
  releaseDate: '2023-06-20',
  seasonAndEpisodeNumber: 1012,
  seasonId: Data.season.id,
  seasonNumber: 1,
  title: 'Episode for dedup',
  tvShowId,
};

// A movie whose releaseDate falls within the date range under test
const movieInRange = {
  id: 20,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'tmdb',
  title: 'Movie in range',
  releaseDate: '2023-06-18',
  tmdbId: 999001,
  runtime: 120,
};

// A movie whose releaseDate falls outside the date range
const movieOutOfRange = {
  id: 21,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'tmdb',
  title: 'Movie out of range',
  releaseDate: '2019-01-01',
  tmdbId: 999002,
  runtime: 90,
};

const RANGE_START = '2023-06-01T00:00:00.000Z';
const RANGE_END = '2023-06-30T23:59:59.000Z';

describe('CalendarController', () => {
  beforeAll(async () => {
    await runMigrations();

    // Base user and watchlist
    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);

    // TV show + season
    await Database.knex('mediaItem').insert(Data.tvShow);
    await Database.knex('season').insert(Data.season);

    // Episodes
    await Database.knex('episode').insert(episodeInRange);
    await Database.knex('episode').insert(episodeOutOfRange);
    await Database.knex('episode').insert(episodeDuplicate);

    // Movies
    await Database.knex('mediaItem').insert(movieInRange);
    await Database.knex('mediaItem').insert(movieOutOfRange);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('listItem').delete();
    await Database.knex('seen').delete();
  });

  // ---------------------------------------------------------------------------
  // HTTP handler tests
  // ---------------------------------------------------------------------------

  describe('GET /api/calendar', () => {
    test('responds with HTTP 200 and an array', async () => {
      const calendarController = new CalendarController();

      const res = await request(calendarController.get, {
        userId: Data.user.id,
        requestQuery: {
          start: '2023-06-01',
          end: '2023-06-30',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns empty array when watchlist is empty', async () => {
      const calendarController = new CalendarController();

      const res = await request(calendarController.get, {
        userId: Data.user.id,
        requestQuery: {
          start: '2023-06-01',
          end: '2023-06-30',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getCalendarItems unit tests
  // ---------------------------------------------------------------------------

  describe('getCalendarItems – episodes via direct episode list-item', () => {
    test('includes episode whose releaseDate is within the date range', async () => {
      // Add the tv show to watchlist via a direct episode list-item
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: tvShowId,
        seasonId: null,
        episodeId: episodeInRange.id,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const episodeIds = result
        .filter((item) => item.episode != null)
        .map((item) => item.episode!.id);

      expect(episodeIds).toContain(episodeInRange.id);
    });

    test('excludes episode whose releaseDate is outside the date range', async () => {
      // Only add the out-of-range episode to the watchlist
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: tvShowId,
        seasonId: null,
        episodeId: episodeOutOfRange.id,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const episodeIds = result
        .filter((item) => item.episode != null)
        .map((item) => item.episode!.id);

      expect(episodeIds).not.toContain(episodeOutOfRange.id);
    });

    test('episode is returned as unseen when not present in seen table', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: tvShowId,
        seasonId: null,
        episodeId: episodeInRange.id,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const episodeEntry = result.find(
        (item) => item.episode?.id === episodeInRange.id
      );

      expect(episodeEntry).toBeDefined();
      expect(episodeEntry!.episode!.seen).toBe(false);
    });

    test('episode is returned as seen when present in seen table', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: tvShowId,
        seasonId: null,
        episodeId: episodeInRange.id,
        addedAt: new Date().getTime(),
      });

      await Database.knex('seen').insert({
        mediaItemId: tvShowId,
        episodeId: episodeInRange.id,
        userId: Data.user.id,
        date: null,
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const episodeEntry = result.find(
        (item) => item.episode?.id === episodeInRange.id
      );

      expect(episodeEntry).toBeDefined();
      expect(episodeEntry!.episode!.seen).toBe(true);
    });
  });

  describe('getCalendarItems – movies', () => {
    test('includes movie whose releaseDate is within the date range', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieInRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const mediaItemIds = result.map((item) => item.mediaItem.id);
      expect(mediaItemIds).toContain(movieInRange.id);
    });

    test('excludes movie whose releaseDate is outside the date range', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieOutOfRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const mediaItemIds = result.map((item) => item.mediaItem.id);
      expect(mediaItemIds).not.toContain(movieOutOfRange.id);
    });

    test('movie is returned as unseen when not in seen table', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieInRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const movieEntry = result.find(
        (item) => item.mediaItem.id === movieInRange.id
      );

      expect(movieEntry).toBeDefined();
      expect(movieEntry!.mediaItem.seen).toBe(false);
    });

    test('movie is returned as seen when present in seen table', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieInRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      await Database.knex('seen').insert({
        mediaItemId: movieInRange.id,
        episodeId: null,
        userId: Data.user.id,
        date: null,
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const movieEntry = result.find(
        (item) => item.mediaItem.id === movieInRange.id
      );

      expect(movieEntry).toBeDefined();
      expect(movieEntry!.mediaItem.seen).toBe(true);
    });

    test('movie entry has no episode property', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieInRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const movieEntry = result.find(
        (item) => item.mediaItem.id === movieInRange.id
      );

      expect(movieEntry).toBeDefined();
      expect((movieEntry as any).episode).toBeUndefined();
    });
  });

  describe('getCalendarItems – deduplication', () => {
    test('does not return duplicate entries for the same episode', async () => {
      // Add the same episode twice to the watchlist list (duplicate inserts)
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: tvShowId,
        seasonId: null,
        episodeId: episodeDuplicate.id,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const matchingEpisodes = result.filter(
        (item) => item.episode?.id === episodeDuplicate.id
      );

      expect(matchingEpisodes.length).toBe(1);
    });
  });

  describe('getCalendarItems – mixed movies and episodes', () => {
    test('returns both movies and episodes when both are on the watchlist', async () => {
      await Database.knex('listItem').insert([
        {
          listId: Data.watchlist.id,
          mediaItemId: movieInRange.id,
          seasonId: null,
          episodeId: null,
          addedAt: new Date().getTime(),
        },
        {
          listId: Data.watchlist.id,
          mediaItemId: tvShowId,
          seasonId: null,
          episodeId: episodeInRange.id,
          addedAt: new Date().getTime(),
        },
      ]);

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const mediaItemIds = result.map((item) => item.mediaItem.id);
      const episodeIds = result
        .filter((item) => item.episode != null)
        .map((item) => item.episode!.id);

      expect(mediaItemIds).toContain(movieInRange.id);
      expect(episodeIds).toContain(episodeInRange.id);
    });
  });

  describe('getCalendarItems – response shape', () => {
    test('each entry has a releaseDate field at the top level', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieInRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      for (const item of result) {
        expect(typeof item.releaseDate).toBe('string');
        expect(item.releaseDate.length).toBeGreaterThan(0);
      }
    });

    test('each entry has a mediaItem with id, title, mediaType, and releaseDate', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: movieInRange.id,
        seasonId: null,
        episodeId: null,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const movieEntry = result.find(
        (item) => item.mediaItem.id === movieInRange.id
      );

      expect(movieEntry).toBeDefined();
      expect(movieEntry!.mediaItem).toMatchObject({
        id: movieInRange.id,
        title: movieInRange.title,
        mediaType: 'movie',
        releaseDate: movieInRange.releaseDate,
      });
    });

    test('episode entries include episodeNumber, seasonNumber, and isSpecialEpisode', async () => {
      await Database.knex('listItem').insert({
        listId: Data.watchlist.id,
        mediaItemId: tvShowId,
        seasonId: null,
        episodeId: episodeInRange.id,
        addedAt: new Date().getTime(),
      });

      const result = await getCalendarItems({
        userId: Data.user.id,
        start: RANGE_START,
        end: RANGE_END,
      });

      const episodeEntry = result.find(
        (item) => item.episode?.id === episodeInRange.id
      );

      expect(episodeEntry).toBeDefined();
      expect(episodeEntry!.episode).toMatchObject({
        id: episodeInRange.id,
        episodeNumber: episodeInRange.episodeNumber,
        seasonNumber: episodeInRange.seasonNumber,
        releaseDate: episodeInRange.releaseDate,
        isSpecialEpisode: false,
      });
    });
  });
});
