import { Database } from 'src/dbconfig';
import { userRepository } from 'src/repository/user';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Integration tests for notification age-gating per recipient (US-007).
 *
 * Verifies that `findNotificationRecipientsForMediaItem`:
 * - Skips recipients whose age is below the content's `minimumAge`.
 * - Includes recipients whose age meets or exceeds `minimumAge`.
 * - Includes recipients with no `dateOfBirth` (no gating for DOB-unset users).
 * - Includes all recipients when `minimumAge` is null (unknown parental metadata).
 * - Correctly filters by optional notification preference flags.
 */
describe('Notification age-gating (US-007)', () => {
  // Unique IDs to avoid collisions with other test suites sharing the SQLite DB
  const ADULT_USER_ID = 7001; // born 1990-01-15, age 36 in 2026
  const TEEN_USER_ID = 7002; // born 2012-06-01, age ~13 in early 2026
  const NO_DOB_USER_ID = 7003;

  const ADULT_WATCHLIST_ID = 7010;
  const TEEN_WATCHLIST_ID = 7011;
  const NO_DOB_WATCHLIST_ID = 7012;

  const R_RATED_MOVIE_ID = 7100; // minimumAge = 17
  const PG13_MOVIE_ID = 7101; // minimumAge = 13
  const UNRATED_MOVIE_ID = 7102; // minimumAge = null
  const R_RATED_TV_SHOW_ID = 7103; // minimumAge = 17 (TV show for episodes test)

  const now = Date.now();

  beforeAll(async () => {
    await runMigrations();

    // Insert users directly (bypass userRepository.create to use fixed IDs)
    await Database.knex('user').insert([
      {
        id: ADULT_USER_ID,
        name: 'adult_us007',
        password: 'password',
        admin: false,
        publicReviews: false,
        dateOfBirth: '1990-01-15', // age 36 in 2026
        sendNotificationForReleases: true,
        sendNotificationForEpisodesReleases: true,
        sendNotificationWhenStatusChanges: true,
        sendNotificationWhenReleaseDateChanges: true,
        sendNotificationWhenNumberOfSeasonsChanges: true,
      },
      {
        id: TEEN_USER_ID,
        name: 'teen_us007',
        password: 'password',
        admin: false,
        publicReviews: false,
        dateOfBirth: '2012-06-01', // age ~13 in early 2026
        sendNotificationForReleases: true,
        sendNotificationForEpisodesReleases: true,
        sendNotificationWhenStatusChanges: true,
        sendNotificationWhenReleaseDateChanges: true,
        sendNotificationWhenNumberOfSeasonsChanges: true,
      },
      {
        id: NO_DOB_USER_ID,
        name: 'nodob_us007',
        password: 'password',
        admin: false,
        publicReviews: false,
        sendNotificationForReleases: true,
        sendNotificationForEpisodesReleases: true,
        sendNotificationWhenStatusChanges: true,
        sendNotificationWhenReleaseDateChanges: true,
        sendNotificationWhenNumberOfSeasonsChanges: true,
      },
    ]);

    // Insert watchlists for each user
    await Database.knex('list').insert([
      {
        id: ADULT_WATCHLIST_ID,
        name: 'Watchlist',
        userId: ADULT_USER_ID,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      },
      {
        id: TEEN_WATCHLIST_ID,
        name: 'Watchlist',
        userId: TEEN_USER_ID,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      },
      {
        id: NO_DOB_WATCHLIST_ID,
        name: 'Watchlist',
        userId: NO_DOB_USER_ID,
        privacy: 'private',
        allowComments: false,
        displayNumbers: false,
        createdAt: now,
        updatedAt: now,
        isWatchlist: true,
        sortBy: 'recently-watched',
        sortOrder: 'desc',
      },
    ]);

    // Insert media items
    await Database.knex('mediaItem').insert([
      {
        id: R_RATED_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'R-Rated Movie US007',
        minimumAge: 17,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'R',
      },
      {
        id: PG13_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'PG-13 Movie US007',
        minimumAge: 13,
        contentRatingSystem: 'MPAA',
        contentRatingLabel: 'PG-13',
      },
      {
        id: UNRATED_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'Unrated Movie US007',
        // minimumAge intentionally omitted (null)
      },
      {
        id: R_RATED_TV_SHOW_ID,
        lastTimeUpdated: now,
        mediaType: 'tv',
        source: 'tmdb',
        title: 'R-Rated TV Show US007',
        minimumAge: 17,
        contentRatingSystem: 'TV-PG',
        contentRatingLabel: 'TV-MA',
      },
    ]);

    // Add watchlist entries for all 3 users × all 4 media items
    await Database.knex('listItem').insert([
      { listId: ADULT_WATCHLIST_ID, mediaItemId: R_RATED_MOVIE_ID, addedAt: now },
      { listId: TEEN_WATCHLIST_ID, mediaItemId: R_RATED_MOVIE_ID, addedAt: now },
      { listId: NO_DOB_WATCHLIST_ID, mediaItemId: R_RATED_MOVIE_ID, addedAt: now },
      { listId: ADULT_WATCHLIST_ID, mediaItemId: PG13_MOVIE_ID, addedAt: now },
      { listId: TEEN_WATCHLIST_ID, mediaItemId: PG13_MOVIE_ID, addedAt: now },
      { listId: NO_DOB_WATCHLIST_ID, mediaItemId: PG13_MOVIE_ID, addedAt: now },
      { listId: ADULT_WATCHLIST_ID, mediaItemId: UNRATED_MOVIE_ID, addedAt: now },
      { listId: TEEN_WATCHLIST_ID, mediaItemId: UNRATED_MOVIE_ID, addedAt: now },
      { listId: NO_DOB_WATCHLIST_ID, mediaItemId: UNRATED_MOVIE_ID, addedAt: now },
      { listId: ADULT_WATCHLIST_ID, mediaItemId: R_RATED_TV_SHOW_ID, addedAt: now },
      { listId: TEEN_WATCHLIST_ID, mediaItemId: R_RATED_TV_SHOW_ID, addedAt: now },
      { listId: NO_DOB_WATCHLIST_ID, mediaItemId: R_RATED_TV_SHOW_ID, addedAt: now },
    ]);
  });

  afterAll(clearDatabase);

  describe('findNotificationRecipientsForMediaItem', () => {
    // -------------------------------------------------------------------------
    // R-rated content (minimumAge = 17)
    // -------------------------------------------------------------------------
    it('includes adult recipient (age 36) for R-rated content', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: R_RATED_MOVIE_ID,
          minimumAge: 17,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).toContain(ADULT_USER_ID);
    });

    it('suppresses teen recipient (age ~13) for R-rated content', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: R_RATED_MOVIE_ID,
          minimumAge: 17,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).not.toContain(TEEN_USER_ID);
    });

    it('includes no-DOB recipient for R-rated content (no gating when DOB unset)', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: R_RATED_MOVIE_ID,
          minimumAge: 17,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).toContain(NO_DOB_USER_ID);
    });

    // -------------------------------------------------------------------------
    // PG-13 content (minimumAge = 13)
    // -------------------------------------------------------------------------
    it('includes teen recipient (age ~13) for PG-13 content', async () => {
      // Teen was born 2012-06-01; in early 2026 (March) they are 13 years old
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: PG13_MOVIE_ID,
          minimumAge: 13,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).toContain(TEEN_USER_ID);
    });

    it('includes adult recipient for PG-13 content', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: PG13_MOVIE_ID,
          minimumAge: 13,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).toContain(ADULT_USER_ID);
    });

    // -------------------------------------------------------------------------
    // Unknown parental metadata (minimumAge = null)
    // -------------------------------------------------------------------------
    it('includes all recipients when minimumAge is null (unknown parental metadata)', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: UNRATED_MOVIE_ID,
          minimumAge: null,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).toContain(ADULT_USER_ID);
      expect(ids).toContain(TEEN_USER_ID);
      expect(ids).toContain(NO_DOB_USER_ID);
    });

    it('includes all recipients when minimumAge is undefined (unknown parental metadata)', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: UNRATED_MOVIE_ID,
          // minimumAge omitted — treated as undefined
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).toContain(ADULT_USER_ID);
      expect(ids).toContain(TEEN_USER_ID);
      expect(ids).toContain(NO_DOB_USER_ID);
    });

    // -------------------------------------------------------------------------
    // Episode-release notification flag filtering
    // -------------------------------------------------------------------------
    it('filters by sendNotificationForEpisodesReleases flag (R-rated TV show)', async () => {
      // Update teen user to opt out of episode releases
      await Database.knex('user')
        .where({ id: TEEN_USER_ID })
        .update({ sendNotificationForEpisodesReleases: false });

      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: R_RATED_TV_SHOW_ID,
          minimumAge: 17,
          sendNotificationForEpisodesReleases: true,
        });

      // Teen is suppressed by age (13 < 17) and also opted out of episode notifications
      const ids = recipients.map((u) => u.id);
      expect(ids).not.toContain(TEEN_USER_ID);

      // Restore
      await Database.knex('user')
        .where({ id: TEEN_USER_ID })
        .update({ sendNotificationForEpisodesReleases: true });
    });

    it('filters by sendNotificationForReleases flag', async () => {
      // Update adult user to opt out of releases
      await Database.knex('user')
        .where({ id: ADULT_USER_ID })
        .update({ sendNotificationForReleases: false });

      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: R_RATED_MOVIE_ID,
          minimumAge: 17,
          sendNotificationForReleases: true,
        });

      const ids = recipients.map((u) => u.id);
      expect(ids).not.toContain(ADULT_USER_ID);

      // Restore
      await Database.knex('user')
        .where({ id: ADULT_USER_ID })
        .update({ sendNotificationForReleases: true });
    });

    // -------------------------------------------------------------------------
    // Return value completeness
    // -------------------------------------------------------------------------
    it('returns users with dateOfBirth included in result (for eligibility audit)', async () => {
      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: R_RATED_MOVIE_ID,
          minimumAge: 17,
        });

      const adult = recipients.find((u) => u.id === ADULT_USER_ID);
      expect(adult).toBeDefined();
      // dateOfBirth should be present so callers can log/audit per-recipient eligibility
      expect(adult?.dateOfBirth).toBe('1990-01-15');
    });

    // -------------------------------------------------------------------------
    // No recipients in result for fully restricted content
    // -------------------------------------------------------------------------
    it('returns empty list when all DOB-having recipients are below minimumAge', async () => {
      // Insert a separate media item and watchlist entry only for TEEN_USER_ID
      const TEEN_ONLY_MOVIE_ID = 7200;

      await Database.knex('mediaItem').insert({
        id: TEEN_ONLY_MOVIE_ID,
        lastTimeUpdated: now,
        mediaType: 'movie',
        source: 'tmdb',
        title: 'Teen-Only R-Rated Movie US007',
        minimumAge: 17,
      });

      await Database.knex('listItem').insert({
        listId: TEEN_WATCHLIST_ID,
        mediaItemId: TEEN_ONLY_MOVIE_ID,
        addedAt: now,
      });

      const recipients =
        await userRepository.findNotificationRecipientsForMediaItem({
          mediaItemId: TEEN_ONLY_MOVIE_ID,
          minimumAge: 17,
        });

      // Teen is below 17, so should be suppressed; no other users have this item
      expect(recipients).toHaveLength(0);

      // Cleanup
      await Database.knex('listItem')
        .where({ mediaItemId: TEEN_ONLY_MOVIE_ID })
        .delete();
      await Database.knex('mediaItem')
        .where({ id: TEEN_ONLY_MOVIE_ID })
        .delete();
    });
  });
});
