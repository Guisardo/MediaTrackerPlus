/**
 * Tests for US-010: Group-scoped majority-watched threshold exclusion
 *
 * Verifies that when orderBy === 'platformRecommended' and groupId is provided,
 * items are excluded only when >50% of group members have watched them. When no
 * groupId is provided, the existing platform-wide "any user has seen" exclusion
 * behavior is preserved unchanged.
 *
 * All IDs start at 300 to avoid collisions with other test files that share
 * the in-memory SQLite database when run in --runInBand mode.
 */
import { Database } from 'src/dbconfig';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

describe("mediaItemRepository.items — group-scoped majority-watched exclusion (US-010)", () => {
  // 4 users: user1 is the querying user, user2/user3/user4 are group members
  const user1 = { id: 300, name: 'majority-excl-user1', password: 'pw' };
  const user2 = { id: 301, name: 'majority-excl-user2', password: 'pw' };
  const user3 = { id: 302, name: 'majority-excl-user3', password: 'pw' };
  const user4 = { id: 303, name: 'majority-excl-user4', password: 'pw' };
  // non-group user who has seen items but should NOT affect group exclusion
  const outsideUser = { id: 304, name: 'majority-excl-outside', password: 'pw' };

  // Watchlists (one per user — required by getItemsKnexSql)
  const watchlist1 = {
    id: 300, userId: user1.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const watchlist2 = {
    id: 301, userId: user2.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const watchlist3 = {
    id: 302, userId: user3.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const watchlist4 = {
    id: 303, userId: user4.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };
  const watchlistOutside = {
    id: 304, userId: outsideUser.id, name: 'Watchlist', privacy: 'private',
    sortBy: 'recently-watched', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: true,
  };

  // A non-watchlist list for user2 to make items show in anyListItem
  const list2 = {
    id: 310, userId: user2.id, name: 'List 2', privacy: 'private',
    sortBy: 'recently-added', sortOrder: 'desc',
    createdAt: Date.now(), updatedAt: Date.now(), isWatchlist: false,
  };

  // -------------------------------------------------------------------------
  // Media items (non-TV movies)
  // -------------------------------------------------------------------------
  // MovieA: watched by 2 out of 4 group members (50% — NOT excluded, need >50%)
  const movieA = {
    id: 300, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'MovieA-50pct', platformRating: 8.0, tmdbRating: 7.0,
  };
  // MovieB: watched by 3 out of 4 group members (75% — excluded)
  const movieB = {
    id: 301, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'MovieB-75pct', platformRating: 9.0, tmdbRating: 8.0,
  };
  // MovieC: watched by 0 group members (not excluded)
  const movieC = {
    id: 302, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'MovieC-0pct', platformRating: 6.0, tmdbRating: 5.0,
  };
  // MovieD: watched only by outsideUser (non-group-member — should NOT affect group exclusion)
  const movieD = {
    id: 303, lastTimeUpdated: Date.now(), mediaType: 'movie', source: 'tmdb',
    title: 'MovieD-outside', platformRating: 7.0, tmdbRating: 6.0,
  };

  // -------------------------------------------------------------------------
  // TV show media items
  // -------------------------------------------------------------------------
  // TVShowE: 3 non-special episodes. 3 out of 4 group members completed all (>50% — excluded)
  const tvShowE = {
    id: 310, lastTimeUpdated: Date.now(), mediaType: 'tv', source: 'tmdb',
    title: 'TVShowE-75pct', platformRating: 8.5, tmdbRating: 8.0,
  };
  // TVShowF: 2 non-special episodes. 1 out of 4 group members completed all (25% — NOT excluded)
  const tvShowF = {
    id: 311, lastTimeUpdated: Date.now(), mediaType: 'tv', source: 'tmdb',
    title: 'TVShowF-25pct', platformRating: 7.5, tmdbRating: 7.0,
  };

  // Seasons (required by episode FK)
  const seasonE = { id: 310, seasonNumber: 1, title: 'Season 1', isSpecialSeason: false, tvShowId: tvShowE.id, numberOfEpisodes: 3 };
  const seasonESpecial = { id: 311, seasonNumber: 0, title: 'Specials', isSpecialSeason: true, tvShowId: tvShowE.id, numberOfEpisodes: 1 };
  const seasonF = { id: 312, seasonNumber: 1, title: 'Season 1', isSpecialSeason: false, tvShowId: tvShowF.id, numberOfEpisodes: 2 };

  // Episodes for TVShowE (3 non-special episodes)
  const epE1 = { id: 310, title: 'E-S01E01', episodeNumber: 1, seasonNumber: 1, seasonId: seasonE.id, tvShowId: tvShowE.id, isSpecialEpisode: false, seasonAndEpisodeNumber: 1001 };
  const epE2 = { id: 311, title: 'E-S01E02', episodeNumber: 2, seasonNumber: 1, seasonId: seasonE.id, tvShowId: tvShowE.id, isSpecialEpisode: false, seasonAndEpisodeNumber: 1002 };
  const epE3 = { id: 312, title: 'E-S01E03', episodeNumber: 3, seasonNumber: 1, seasonId: seasonE.id, tvShowId: tvShowE.id, isSpecialEpisode: false, seasonAndEpisodeNumber: 1003 };
  // One special episode for TVShowE (should not count)
  const epESpecial = { id: 313, title: 'E-Special', episodeNumber: 1, seasonNumber: 0, seasonId: seasonESpecial.id, tvShowId: tvShowE.id, isSpecialEpisode: true, seasonAndEpisodeNumber: 1 };

  // Episodes for TVShowF (2 non-special episodes)
  const epF1 = { id: 320, title: 'F-S01E01', episodeNumber: 1, seasonNumber: 1, seasonId: seasonF.id, tvShowId: tvShowF.id, isSpecialEpisode: false, seasonAndEpisodeNumber: 1001 };
  const epF2 = { id: 321, title: 'F-S01E02', episodeNumber: 2, seasonNumber: 1, seasonId: seasonF.id, tvShowId: tvShowF.id, isSpecialEpisode: false, seasonAndEpisodeNumber: 1002 };

  // Group: 4 members (user1, user2, user3, user4)
  const groupId = 300;

  // Group platform ratings (needed so items appear with scores)
  const gprMovieA = { id: 300, groupId, mediaItemId: movieA.id, rating: 8.0 };
  const gprMovieB = { id: 301, groupId, mediaItemId: movieB.id, rating: 9.0 };
  const gprMovieC = { id: 302, groupId, mediaItemId: movieC.id, rating: 6.0 };
  const gprMovieD = { id: 303, groupId, mediaItemId: movieD.id, rating: 7.0 };
  const gprTvShowE = { id: 304, groupId, mediaItemId: tvShowE.id, rating: 8.5 };
  const gprTvShowF = { id: 305, groupId, mediaItemId: tvShowF.id, rating: 7.5 };

  beforeAll(async () => {
    await runMigrations();

    // Insert users
    await Database.knex('user').insert([user1, user2, user3, user4, outsideUser]);

    // Insert watchlists
    await Database.knex('list').insert([watchlist1, watchlist2, watchlist3, watchlist4, watchlistOutside, list2]);

    // Insert media items
    await Database.knex('mediaItem').insert([movieA, movieB, movieC, movieD, tvShowE, tvShowF]);

    // Insert seasons (required by episode FK)
    await Database.knex('season').insert([seasonE, seasonESpecial, seasonF]);

    // Insert episodes
    await Database.knex('episode').insert([epE1, epE2, epE3, epESpecial, epF1, epF2]);

    // Put all items on user2's list so they show in anyListItem
    await Database.knex('listItem').insert([
      { listId: list2.id, mediaItemId: movieA.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: movieB.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: movieC.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: movieD.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: tvShowE.id, addedAt: Date.now() },
      { listId: list2.id, mediaItemId: tvShowF.id, addedAt: Date.now() },
    ]);

    // Insert group and members (4 members)
    await Database.knex('userGroup').insert({
      id: groupId, name: 'Majority Watched Test Group',
      createdBy: user1.id, createdAt: Date.now(),
    });
    await Database.knex('userGroupMember').insert([
      { id: 300, groupId, userId: user1.id, role: 'admin', addedAt: Date.now() },
      { id: 301, groupId, userId: user2.id, role: 'viewer', addedAt: Date.now() },
      { id: 302, groupId, userId: user3.id, role: 'viewer', addedAt: Date.now() },
      { id: 303, groupId, userId: user4.id, role: 'viewer', addedAt: Date.now() },
    ]);

    // Insert group platform ratings
    await Database.knex('groupPlatformRating').insert([
      gprMovieA, gprMovieB, gprMovieC, gprMovieD, gprTvShowE, gprTvShowF,
    ]);

    // -----------------------------------------------------------------------
    // Seen entries for non-TV items
    // -----------------------------------------------------------------------
    // MovieA: user1 and user2 have seen it (2 out of 4 = 50%, NOT excluded since >50% is needed)
    await Database.knex('seen').insert([
      { id: 300, mediaItemId: movieA.id, userId: user1.id, date: Date.now() },
      { id: 301, mediaItemId: movieA.id, userId: user2.id, date: Date.now() },
    ]);

    // MovieB: user1, user2, user3 have seen it (3 out of 4 = 75%, excluded)
    await Database.knex('seen').insert([
      { id: 302, mediaItemId: movieB.id, userId: user1.id, date: Date.now() },
      { id: 303, mediaItemId: movieB.id, userId: user2.id, date: Date.now() },
      { id: 304, mediaItemId: movieB.id, userId: user3.id, date: Date.now() },
    ]);

    // MovieC: no seen entries from anyone

    // MovieD: only outsideUser has seen it (non-group-member — should NOT affect group exclusion)
    await Database.knex('seen').insert([
      { id: 305, mediaItemId: movieD.id, userId: outsideUser.id, date: Date.now() },
    ]);

    // -----------------------------------------------------------------------
    // Seen entries for TV shows (episode-level)
    // -----------------------------------------------------------------------
    // TVShowE: 3 non-special episodes. user1, user2, user3 have seen all 3 (75%, excluded)
    // user4 has only seen 1 episode (not completed)
    for (const [idx, uid] of [user1.id, user2.id, user3.id].entries()) {
      await Database.knex('seen').insert([
        { id: 400 + idx * 10, mediaItemId: tvShowE.id, userId: uid, episodeId: epE1.id, date: Date.now() },
        { id: 401 + idx * 10, mediaItemId: tvShowE.id, userId: uid, episodeId: epE2.id, date: Date.now() },
        { id: 402 + idx * 10, mediaItemId: tvShowE.id, userId: uid, episodeId: epE3.id, date: Date.now() },
      ]);
    }
    // user4: only seen episode 1 of TVShowE
    await Database.knex('seen').insert([
      { id: 450, mediaItemId: tvShowE.id, userId: user4.id, episodeId: epE1.id, date: Date.now() },
    ]);
    // user1 also watched the special episode (should not count in exclusion logic)
    await Database.knex('seen').insert([
      { id: 460, mediaItemId: tvShowE.id, userId: user1.id, episodeId: epESpecial.id, date: Date.now() },
    ]);

    // TVShowF: 2 non-special episodes. Only user1 has completed all (25%, NOT excluded)
    await Database.knex('seen').insert([
      { id: 500, mediaItemId: tvShowF.id, userId: user1.id, episodeId: epF1.id, date: Date.now() },
      { id: 501, mediaItemId: tvShowF.id, userId: user1.id, episodeId: epF2.id, date: Date.now() },
    ]);
    // user2: only seen episode 1 of TVShowF (not completed)
    await Database.knex('seen').insert([
      { id: 502, mediaItemId: tvShowF.id, userId: user2.id, episodeId: epF1.id, date: Date.now() },
    ]);
  });

  afterAll(clearDatabase);

  // -------------------------------------------------------------------------
  // Non-TV: majority-watched threshold
  // -------------------------------------------------------------------------

  test('non-TV: item watched by >50% of group (MovieB: 3/4=75%) IS excluded', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    expect(titles).not.toContain('MovieB-75pct');
  });

  test('non-TV: item watched by exactly 50% of group (MovieA: 2/4=50%) is NOT excluded', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    expect(titles).toContain('MovieA-50pct');
  });

  test('non-TV: item watched by 0% of group (MovieC) is NOT excluded', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    expect(titles).toContain('MovieC-0pct');
  });

  test('non-TV: non-group-member watches do NOT affect group exclusion (MovieD watched by outsideUser only)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    // outsideUser is not a group member — their seen entry should not count
    expect(titles).toContain('MovieD-outside');
  });

  // -------------------------------------------------------------------------
  // TV shows: majority-watched threshold (all-episodes logic)
  // -------------------------------------------------------------------------

  test('TV: show completed by >50% of group (TVShowE: 3/4=75%) IS excluded', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    expect(titles).not.toContain('TVShowE-75pct');
  });

  test('TV: show completed by <=50% of group (TVShowF: 1/4=25%) is NOT excluded', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      groupId,
    });

    const titles = items.map((i) => i.title);
    expect(titles).toContain('TVShowF-25pct');
  });

  // -------------------------------------------------------------------------
  // Existing behavior preserved when no groupId
  // -------------------------------------------------------------------------

  test('without groupId: existing platform-wide exclusion is preserved — MovieD excluded (outsideUser has seen it)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      // no groupId — global behavior
    });

    const titles = items.map((i) => i.title);
    // Without groupId, ANY user having seen the item causes exclusion.
    // MovieD was watched by outsideUser, so it should be excluded in global mode.
    expect(titles).not.toContain('MovieD-outside');
  });

  test('without groupId: MovieA excluded (any platform user has seen it)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      // no groupId — global behavior
    });

    const titles = items.map((i) => i.title);
    // user1 and user2 have seen MovieA — in global mode, this means exclusion
    expect(titles).not.toContain('MovieA-50pct');
  });

  test('without groupId: MovieC included (no one has seen it)', async () => {
    const items = await mediaItemRepository.items({
      userId: user1.id,
      orderBy: 'platformRecommended',
      sortOrder: 'desc',
      // no groupId
    });

    const titles = items.map((i) => i.title);
    expect(titles).toContain('MovieC-0pct');
  });
});
