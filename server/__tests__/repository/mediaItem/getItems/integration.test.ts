/**
 * US-023: Integration tests for Content List Facets feature.
 *
 * Comprehensive end-to-end tests verifying the complete facet filtering system
 * including: multi-dimension filtering, facet count accuracy, cross-type behavior,
 * sort order preservation, URL-style param bookmarkability, and backward compatibility.
 *
 * These tests exercise the full stack from repository through Knex query layer,
 * simulating complete user journeys through the faceted content list feature.
 */

import { mediaItemRepository } from 'src/repository/mediaItem';
import { MediaItemBase } from 'src/entity/mediaItem';
import { User } from 'src/entity/user';
import { userRepository } from 'src/repository/user';
import { clearDatabase, runMigrations } from '../../../__utils__/utils';
import { listItemRepository } from 'src/repository/listItemRepository';
import { seenRepository } from 'src/repository/seen';
import { userRatingRepository } from 'src/repository/userRating';

// ─── Users ───────────────────────────────────────────────────────────

const user1: User = {
  id: 1,
  name: 'user1',
  password: 'password',
};

const user2: User = {
  id: 2,
  name: 'user2',
  password: 'password',
};

// ─── Movies ──────────────────────────────────────────────────────────

/** Action/Sci-Fi movie, en, director: Christopher Nolan, rating 9.0, 2010 */
const movieInception: MediaItemBase = {
  id: 1,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Inception',
  genres: ['Action', 'Sci-Fi'],
  language: 'en',
  director: 'Christopher Nolan',
  tmdbRating: 9.0,
  releaseDate: '2010-07-16',
};

/** Comedy/Action movie, fr, director: Luc Besson, rating 7.5, 2019 */
const movieLucy: MediaItemBase = {
  id: 2,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Lucy',
  genres: ['Comedy', 'Action'],
  language: 'fr',
  director: 'Luc Besson',
  tmdbRating: 7.5,
  releaseDate: '2019-01-15',
};

/** Drama movie, en, director: Christopher Nolan, rating 8.5, 2014 */
const movieInterstellar: MediaItemBase = {
  id: 3,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Interstellar',
  genres: ['Drama', 'Sci-Fi'],
  language: 'en',
  director: 'Christopher Nolan',
  tmdbRating: 8.5,
  releaseDate: '2014-11-07',
};

// ─── TV Shows ────────────────────────────────────────────────────────

/** Drama/Crime TV, en, creator: Vince Gilligan, rating 9.5, 2008 */
const tvBreakingBad: MediaItemBase = {
  id: 4,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'user',
  title: 'Breaking Bad',
  genres: ['Drama', 'Crime'],
  language: 'en',
  creator: 'Vince Gilligan',
  tmdbRating: 9.5,
  releaseDate: '2008-01-20',
};

/** Sci-Fi/Drama TV, en, creator: Bong Joon-ho, rating 8.0, 2020 */
const tvAlternateSci: MediaItemBase = {
  id: 5,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'user',
  title: 'Alternate SciFi Show',
  genres: ['Sci-Fi', 'Drama'],
  language: 'en',
  creator: 'Bong Joon-ho',
  tmdbRating: 8.0,
  releaseDate: '2020-06-15',
};

// ─── Video Games ─────────────────────────────────────────────────────

/** RPG game, en, developer: CD Projekt Red, publisher: CD Projekt, no rating, 2015 */
const gameWitcher: MediaItemBase = {
  id: 6,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'video_game',
  source: 'user',
  title: 'The Witcher 3',
  genres: ['RPG'],
  language: 'en',
  developer: 'CD Projekt Red',
  publisher: 'CD Projekt',
  tmdbRating: undefined,
  releaseDate: '2015-05-19',
};

/** Action/RPG game, ja, developer: FromSoftware, publisher: Bandai Namco, rating 9.2, 2022 */
const gameEldenRing: MediaItemBase = {
  id: 7,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'video_game',
  source: 'user',
  title: 'Elden Ring',
  genres: ['Action', 'RPG'],
  language: 'ja',
  developer: 'FromSoftware',
  publisher: 'Bandai Namco',
  tmdbRating: 9.2,
  releaseDate: '2022-02-25',
};

// ─── Books ───────────────────────────────────────────────────────────

/** Science Fiction book, en, author: Frank Herbert, rating 5.0, 2000 */
const bookDune: MediaItemBase = {
  id: 8,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'book',
  source: 'user',
  title: 'Dune',
  genres: ['Science Fiction'],
  language: 'en',
  authors: ['Frank Herbert'],
  tmdbRating: 5.0,
  releaseDate: '2000-06-01',
};

/** Fantasy book, en, author: Patrick Rothfuss, rating 8.5, 2007 */
const bookKingkiller: MediaItemBase = {
  id: 9,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'book',
  source: 'user',
  title: 'The Name of the Wind',
  genres: ['Fantasy'],
  language: 'en',
  authors: ['Patrick Rothfuss'],
  tmdbRating: 8.5,
  releaseDate: '2007-03-27',
};

// ─── Audiobooks ──────────────────────────────────────────────────────

/** Fantasy audiobook, de, author: J.R.R. Tolkien, rating 9.0, 1954 */
const audiobookLOTR: MediaItemBase = {
  id: 10,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'audiobook',
  source: 'user',
  title: 'The Lord of the Rings',
  genres: ['Fantasy'],
  language: 'de',
  authors: ['J.R.R. Tolkien'],
  tmdbRating: 9.0,
  releaseDate: '1954-07-29',
};

// ─── User2-only items ────────────────────────────────────────────────

/** Thriller movie only in user2's library */
const movieUser2Only: MediaItemBase = {
  id: 11,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'movie',
  source: 'user',
  title: 'Secret Movie',
  genres: ['Thriller'],
  language: 'es',
  director: 'Secret Director',
  tmdbRating: 6.0,
  releaseDate: '2022-01-01',
};

// ─── Helpers ─────────────────────────────────────────────────────────

const addToWatchlistAndSeen = async (
  userId: number,
  mediaItemId: number,
  addWatchlist = true,
  addSeen = true
) => {
  if (addWatchlist) {
    await listItemRepository.addItem({
      userId,
      watchlist: true,
      mediaItemId,
    });
  }
  if (addSeen) {
    await seenRepository.create({
      mediaItemId,
      userId,
      date: new Date().getTime(),
    });
  }
};

// ─── Test Suite ──────────────────────────────────────────────────────

describe('US-023: Content List Facets Integration Tests', () => {
  beforeAll(async () => {
    await runMigrations();
    await userRepository.create(user1);
    await userRepository.create(user2);

    await mediaItemRepository.createMany([
      movieInception,
      movieLucy,
      movieInterstellar,
      tvBreakingBad,
      tvAlternateSci,
      gameWitcher,
      gameEldenRing,
      bookDune,
      bookKingkiller,
      audiobookLOTR,
      movieUser2Only,
    ]);

    // user1's library (10 items): all except movieUser2Only
    await addToWatchlistAndSeen(user1.id, movieInception.id, true, true);
    await addToWatchlistAndSeen(user1.id, movieLucy.id, true, true);
    await addToWatchlistAndSeen(user1.id, movieInterstellar.id, true, true);
    await addToWatchlistAndSeen(user1.id, tvBreakingBad.id, true, true);
    await addToWatchlistAndSeen(user1.id, tvAlternateSci.id, true, true);
    await addToWatchlistAndSeen(user1.id, gameWitcher.id, true, false); // watchlist only, not seen
    await addToWatchlistAndSeen(user1.id, gameEldenRing.id, true, true);
    await addToWatchlistAndSeen(user1.id, bookDune.id, true, true);
    await addToWatchlistAndSeen(user1.id, bookKingkiller.id, true, true);
    await addToWatchlistAndSeen(user1.id, audiobookLOTR.id, true, true);

    // user2's library: only movieUser2Only
    await addToWatchlistAndSeen(user2.id, movieUser2Only.id, true, true);

    // User ratings for user1
    await userRatingRepository.create({
      id: 300,
      mediaItemId: movieInception.id,
      userId: user1.id,
      rating: 10,
      date: new Date().getTime(),
    });
    await userRatingRepository.create({
      id: 301,
      mediaItemId: movieInterstellar.id,
      userId: user1.id,
      rating: 9,
      date: new Date().getTime(),
    });
    await userRatingRepository.create({
      id: 302,
      mediaItemId: tvBreakingBad.id,
      userId: user1.id,
      rating: 10,
      date: new Date().getTime(),
    });
  });

  afterAll(clearDatabase);

  // ─── 1. Genre facet on movies page ───────────────────────────────

  describe('genre facet on movies page', () => {
    test('genre facet filters movies, grid shows only matching, chip visible, counts update', async () => {
      // Step 1: Get unfiltered facets scoped to movies
      const unfilteredFacets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      // Verify genre counts for movies: Action (2: Inception, Lucy), Sci-Fi (2: Inception, Interstellar),
      // Comedy (1: Lucy), Drama (1: Interstellar)
      const unfilteredGenreMap = new Map(
        unfilteredFacets.genres.map((g) => [g.value, g.count])
      );
      expect(unfilteredGenreMap.get('Action')).toBe(2);
      expect(unfilteredGenreMap.get('Sci-Fi')).toBe(2);
      expect(unfilteredGenreMap.get('Comedy')).toBe(1);
      expect(unfilteredGenreMap.get('Drama')).toBe(1);

      // Step 2: Apply genre=Action filter
      const filteredItems = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'movie',
        genres: 'Action',
      });

      // Only Action movies: Inception and Lucy
      const titles = filteredItems.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Lucy');
      expect(titles).not.toContain('Interstellar');
      expect(filteredItems.length).toBe(2);

      // Step 3: Verify facet counts update after filtering
      const filteredFacets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
        genres: 'Action',
      });

      // When genre=Action: Action (2), Sci-Fi (1: Inception), Comedy (1: Lucy)
      const filteredGenreMap = new Map(
        filteredFacets.genres.map((g) => [g.value, g.count])
      );
      expect(filteredGenreMap.get('Action')).toBe(2);
      expect(filteredGenreMap.get('Sci-Fi')).toBe(1); // only Inception
      expect(filteredGenreMap.get('Comedy')).toBe(1); // only Lucy
      expect(filteredGenreMap.get('Drama')).toBeUndefined(); // Interstellar excluded

      // Step 4: Verify languages facets narrowed too
      const langMap = new Map(
        filteredFacets.languages.map((l) => [l.value, l.count])
      );
      expect(langMap.get('en')).toBe(1); // only Inception
      expect(langMap.get('fr')).toBe(1); // only Lucy
    });
  });

  // ─── 2. Multiple facets simultaneously (genre + year + language) ──

  describe('multiple facets simultaneously', () => {
    test('genre + year range + language apply AND logic between dimensions, OR within genre', async () => {
      // Apply: genres=Action,Sci-Fi (OR) AND yearMin=2010 AND yearMax=2020 AND languages=en
      const items = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Action,Sci-Fi',
        yearMin: 2010,
        yearMax: 2020,
        languages: 'en',
      });

      // Action or Sci-Fi items in 2010-2020 with language=en:
      // - Inception: Action,Sci-Fi + 2010 + en ✓
      // - Lucy: Action,Comedy + 2019 + fr ✗ (not en)
      // - Interstellar: Drama,Sci-Fi + 2014 + en ✓
      // - tvAlternateSci: Sci-Fi,Drama + 2020 + en ✓
      // - tvBreakingBad: Drama,Crime + 2008 + en ✗ (no Action/Sci-Fi)
      // etc.
      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Interstellar');
      expect(titles).toContain('Alternate SciFi Show');
      expect(titles).not.toContain('Lucy'); // fr language
      expect(titles).not.toContain('Breaking Bad'); // no Action/Sci-Fi
      expect(titles).not.toContain('The Witcher 3'); // 2015 but genre is RPG only
      expect(titles).not.toContain('Elden Ring'); // 2022 outside range

      // Verify facets reflect combined filters
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        genres: 'Action,Sci-Fi',
        yearMin: 2010,
        yearMax: 2020,
        languages: 'en',
      });

      // Only en items remain, so languages facet shows only en
      expect(facets.languages.length).toBe(1);
      expect(facets.languages[0].value).toBe('en');
    });
  });

  // ─── 3. Year range slider ────────────────────────────────────────

  describe('year range slider', () => {
    test('yearMin and yearMax filter grid correctly by releaseDate year', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        yearMin: 2015,
        yearMax: 2020,
      });

      const titles = items.map((i) => i.title);
      // Items in 2015-2020:
      // - Lucy: 2019 ✓
      // - gameWitcher: 2015 ✓
      // - tvAlternateSci: 2020 ✓
      expect(titles).toContain('Lucy');
      expect(titles).toContain('The Witcher 3');
      expect(titles).toContain('Alternate SciFi Show');
      // Excluded:
      expect(titles).not.toContain('Inception'); // 2010
      expect(titles).not.toContain('Breaking Bad'); // 2008
      expect(titles).not.toContain('Elden Ring'); // 2022
      expect(titles).not.toContain('Dune'); // 2000
      expect(titles).not.toContain('The Lord of the Rings'); // 1954
    });

    test('yearMin only — filters items released at or after year', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        yearMin: 2020,
      });

      const titles = items.map((i) => i.title);
      // 2020+: Alternate SciFi Show (2020), Elden Ring (2022)
      expect(titles).toContain('Alternate SciFi Show');
      expect(titles).toContain('Elden Ring');
      expect(titles).not.toContain('Inception');
      expect(titles).not.toContain('Lucy');
      expect(items.length).toBe(2);
    });

    test('yearMax only — filters items released at or before year', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        yearMax: 2000,
      });

      const titles = items.map((i) => i.title);
      // <=2000: Dune (2000), LOTR (1954)
      expect(titles).toContain('Dune');
      expect(titles).toContain('The Lord of the Rings');
      expect(titles).not.toContain('Inception');
      expect(items.length).toBe(2);
    });

    test('year range facets correctly reflect filtered set', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        yearMin: 2015,
        yearMax: 2020,
      });

      const yearValues = facets.years.map((y) => y.value);
      expect(yearValues).toContain('2015');
      expect(yearValues).toContain('2019');
      expect(yearValues).toContain('2020');
      expect(yearValues).not.toContain('2010');
      expect(yearValues).not.toContain('2008');
      expect(yearValues).not.toContain('2022');
    });
  });

  // ─── 4. Rating range slider ──────────────────────────────────────

  describe('rating range slider', () => {
    test('ratingMin > 0 excludes items with no tmdbRating', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        ratingMin: 0.5,
      });

      const titles = items.map((i) => i.title);
      // The Witcher 3 has no tmdbRating — excluded when ratingMin > 0
      expect(titles).not.toContain('The Witcher 3');
      // All others have ratings
      expect(titles).toContain('Inception');
      expect(titles).toContain('Elden Ring');
    });

    test('ratingMin and ratingMax create inclusive bounds', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        ratingMin: 8.5,
        ratingMax: 9.2,
      });

      const titles = items.map((i) => i.title);
      // Rating 8.5-9.2: Inception (9.0), Interstellar (8.5), LOTR (9.0), Elden Ring (9.2)
      expect(titles).toContain('Inception'); // 9.0
      expect(titles).toContain('Interstellar'); // 8.5
      expect(titles).toContain('The Lord of the Rings'); // 9.0
      expect(titles).toContain('Elden Ring'); // 9.2
      // Excluded:
      expect(titles).not.toContain('Breaking Bad'); // 9.5 above max
      expect(titles).not.toContain('Lucy'); // 7.5 below min
      expect(titles).not.toContain('Dune'); // 5.0 below min
      expect(titles).not.toContain('The Witcher 3'); // no rating
    });

    test('rating facets correctly reflect filtered set', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        ratingMin: 8.5,
        ratingMax: 9.2,
      });

      // Should only contain items matching the rating range
      const mtMap = new Map(
        facets.mediaTypes.map((m) => [m.value, m.count])
      );
      // video_game: Elden Ring (9.2) only, not Witcher 3 (no rating)
      expect(mtMap.get('video_game')).toBe(1);
      // movie: Inception (9.0) + Interstellar (8.5) = 2
      expect(mtMap.get('movie')).toBe(2);
    });
  });

  // ─── 5. Creator facet with media-type-aware labels ────────────────

  describe('creator facet across media types', () => {
    test('movies page: only directors appear in creators facet', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      const creatorValues = facets.creators.map((c) => c.value);
      // Movie directors
      expect(creatorValues).toContain('Christopher Nolan');
      expect(creatorValues).toContain('Luc Besson');
      // Non-movie creators should not appear
      expect(creatorValues).not.toContain('Vince Gilligan');
      expect(creatorValues).not.toContain('Frank Herbert');
      expect(creatorValues).not.toContain('CD Projekt Red');
    });

    test('books page: only authors appear in creators facet', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'book',
      });

      const creatorValues = facets.creators.map((c) => c.value);
      expect(creatorValues).toContain('Frank Herbert');
      expect(creatorValues).toContain('Patrick Rothfuss');
      expect(creatorValues).not.toContain('Christopher Nolan');
      expect(creatorValues).not.toContain('Vince Gilligan');
    });

    test('mixed-content (no mediaType): union of all creator types', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const creatorValues = facets.creators.map((c) => c.value);
      // All creator types present
      expect(creatorValues).toContain('Christopher Nolan'); // movie director
      expect(creatorValues).toContain('Luc Besson'); // movie director
      expect(creatorValues).toContain('Vince Gilligan'); // TV creator
      expect(creatorValues).toContain('Bong Joon-ho'); // TV creator
      expect(creatorValues).toContain('CD Projekt Red'); // game developer
      expect(creatorValues).toContain('FromSoftware'); // game developer
      expect(creatorValues).toContain('Frank Herbert'); // book author
      expect(creatorValues).toContain('Patrick Rothfuss'); // book author
      expect(creatorValues).toContain('J.R.R. Tolkien'); // audiobook author
    });

    test('creator filter correctly matches across all creator fields', async () => {
      // Filter by a book author
      const items = await mediaItemRepository.items({
        userId: user1.id,
        creators: 'Frank Herbert',
      });

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Dune');
    });

    test('creator with count > 1: Christopher Nolan directs 2 movies', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      const nolanEntry = facets.creators.find(
        (c) => c.value === 'Christopher Nolan'
      );
      expect(nolanEntry).toBeDefined();
      expect(nolanEntry!.count).toBe(2); // Inception + Interstellar
    });
  });

  // ─── 6. Publisher facet visibility ────────────────────────────────

  describe('publisher facet visibility and filtering', () => {
    test('publishers renders on games page (mediaType=video_game)', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'video_game',
      });

      expect(facets.publishers.length).toBeGreaterThan(0);
      const pubMap = new Map(
        facets.publishers.map((p) => [p.value, p.count])
      );
      expect(pubMap.get('CD Projekt')).toBe(1);
      expect(pubMap.get('Bandai Namco')).toBe(1);
    });

    test('publishers renders on mixed-content pages (no mediaType)', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      expect(facets.publishers.length).toBeGreaterThan(0);
    });

    test('publishers excluded on movies page', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      expect(facets.publishers).toEqual([]);
    });

    test('publishers excluded on TV page', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'tv',
      });

      expect(facets.publishers).toEqual([]);
    });

    test('publishers excluded on books page', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'book',
      });

      expect(facets.publishers).toEqual([]);
    });

    test('publishers excluded on audiobooks page', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'audiobook',
      });

      expect(facets.publishers).toEqual([]);
    });

    test('publisher filter correctly narrows game items', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        publishers: 'CD Projekt',
      });

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('The Witcher 3');
    });
  });

  // ─── 7. Status facet (replaces FilterBy) ──────────────────────────

  describe('status facet', () => {
    test('status=rated returns only items with user rating', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        status: 'rated',
      });

      const titles = items.map((i) => i.title);
      // user1 rated: Inception (300), Interstellar (301), Breaking Bad (302)
      expect(titles).toContain('Inception');
      expect(titles).toContain('Interstellar');
      expect(titles).toContain('Breaking Bad');
      expect(items.length).toBe(3);
    });

    test('status=unrated returns only items without user rating', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        status: 'unrated',
      });

      const titles = items.map((i) => i.title);
      // Unrated items: Lucy, AlternateSci, Witcher3, EldenRing, Dune, Kingkiller, LOTR
      expect(titles).not.toContain('Inception');
      expect(titles).not.toContain('Interstellar');
      expect(titles).not.toContain('Breaking Bad');
      expect(items.length).toBe(7);
    });

    test('status=seen returns only seen items', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        status: 'seen',
      });

      const titles = items.map((i) => i.title);
      // gameWitcher was watchlist-only, not seen
      expect(titles).not.toContain('The Witcher 3');
      expect(items.length).toBe(9); // all 10 except Witcher 3
    });

    test('status=watchlist returns items on watchlist', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        status: 'watchlist',
      });

      // All 10 items were added to watchlist
      expect(items.length).toBe(10);
    });

    test('multiple statuses with AND logic', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        status: 'rated,seen',
      });

      // Must be both rated AND seen
      // Inception: rated ✓, seen ✓
      // Interstellar: rated ✓, seen ✓
      // Breaking Bad: rated ✓, seen ✓
      // gameWitcher: not rated, not seen ✗
      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Interstellar');
      expect(titles).toContain('Breaking Bad');
      expect(items.length).toBe(3);
    });

    test('status facets correctly narrow counts', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        status: 'rated',
      });

      // Only 3 rated items: 2 movies (Inception, Interstellar) + 1 TV (Breaking Bad)
      const mtMap = new Map(
        facets.mediaTypes.map((m) => [m.value, m.count])
      );
      expect(mtMap.get('movie')).toBe(2);
      expect(mtMap.get('tv')).toBe(1);
      expect(mtMap.get('video_game')).toBeUndefined();
      expect(mtMap.get('book')).toBeUndefined();
      expect(mtMap.get('audiobook')).toBeUndefined();
    });
  });

  // ─── 8. Media Type facet on mixed-content pages ───────────────────

  describe('media type facet on mixed-content pages', () => {
    test('mediaTypes facet renders on mixed-content pages (no mediaType)', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      expect(facets.mediaTypes.length).toBeGreaterThan(0);
      const mtMap = new Map(
        facets.mediaTypes.map((m) => [m.value, m.count])
      );
      expect(mtMap.get('movie')).toBe(3); // Inception, Lucy, Interstellar
      expect(mtMap.get('tv')).toBe(2); // Breaking Bad, Alternate SciFi
      expect(mtMap.get('video_game')).toBe(2); // Witcher 3, Elden Ring
      expect(mtMap.get('book')).toBe(2); // Dune, Kingkiller
      expect(mtMap.get('audiobook')).toBe(1); // LOTR
    });

    test('mediaTypes filter narrows grid to selected types', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        mediaTypes: 'movie,tv',
      });

      const types = new Set(items.map((i) => i.mediaType));
      expect(types.has('movie')).toBe(true);
      expect(types.has('tv')).toBe(true);
      expect(types.has('video_game')).toBe(false);
      expect(types.has('book')).toBe(false);
      expect(items.length).toBe(5); // 3 movies + 2 TV
    });

    test('mediaTypes facet omitted on single-type pages (already scoped)', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      expect(facets.mediaTypes).toEqual([]);
    });
  });

  // ─── 9. Individual chip dismissal and Clear All ───────────────────

  describe('chip dismissal and clear all', () => {
    test('removing genre from multi-genre filter restores wider result set', async () => {
      // Start with genres=Action,Drama
      const withBoth = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Action,Drama',
      });
      // Action OR Drama: Inception(A,SF), Lucy(C,A), Interstellar(D,SF), BreakingBad(D,C), AlternateSci(SF,D)
      const withBothTitles = withBoth.map((i) => i.title);

      // Dismiss Action chip → only Drama
      const withDrama = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Drama',
      });
      const dramaTitles = withDrama.map((i) => i.title);

      // Drama items: Interstellar, BreakingBad, AlternateSci
      expect(dramaTitles).toContain('Interstellar');
      expect(dramaTitles).toContain('Breaking Bad');
      expect(dramaTitles).toContain('Alternate SciFi Show');
      expect(dramaTitles).not.toContain('Lucy'); // Comedy,Action only
      // With both had more items
      expect(withBoth.length).toBeGreaterThan(withDrama.length);
    });

    test('clearing all filters restores full result set', async () => {
      // Start with heavy filtering
      const filtered = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Action',
        languages: 'en',
        yearMin: 2010,
        ratingMin: 9.0,
      });

      // Clear all (no filters)
      const cleared = await mediaItemRepository.items({
        userId: user1.id,
      });

      expect(cleared.length).toBe(10); // All user1 items
      expect(filtered.length).toBeLessThan(cleared.length);
    });

    test('removing year range restores items from all years', async () => {
      const withYear = await mediaItemRepository.items({
        userId: user1.id,
        yearMin: 2020,
      });
      const withoutYear = await mediaItemRepository.items({
        userId: user1.id,
      });

      expect(withoutYear.length).toBe(10);
      expect(withYear.length).toBeLessThan(withoutYear.length);
    });
  });

  // ─── 10. Sort order preserved through facet apply/remove ──────────

  describe('sort order preserved through facet cycles', () => {
    test('orderBy=title asc preserved with genre facet', async () => {
      const result = await mediaItemRepository.items({
        userId: user1.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        genres: 'Action',
      });

      // Action items sorted alphabetically: Elden Ring, Inception, Lucy
      const titles = result.data.map((i) => i.title);
      for (let i = 0; i < titles.length - 1; i++) {
        expect(titles[i].localeCompare(titles[i + 1])).toBeLessThanOrEqual(0);
      }
    });

    test('orderBy=releaseDate desc with rating filter', async () => {
      const result = await mediaItemRepository.items({
        userId: user1.id,
        page: 1,
        orderBy: 'releaseDate',
        sortOrder: 'desc',
        ratingMin: 8.0,
      });

      // Items with rating >= 8.0, sorted by releaseDate desc (newest first)
      for (let i = 0; i < result.data.length - 1; i++) {
        const curr = result.data[i].releaseDate || '';
        const next = result.data[i + 1].releaseDate || '';
        expect(curr >= next).toBe(true);
      }
    });

    test('applying then removing facet preserves sort order', async () => {
      // Step 1: sorted without facet
      const step1 = await mediaItemRepository.items({
        userId: user1.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
      });

      // Step 2: add facet (reduces items)
      const step2 = await mediaItemRepository.items({
        userId: user1.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
        genres: 'Action',
      });

      // Step 3: remove facet (back to full set) — same sort preserved
      const step3 = await mediaItemRepository.items({
        userId: user1.id,
        page: 1,
        orderBy: 'title',
        sortOrder: 'asc',
      });

      // step1 and step3 should produce identical ordered results
      expect(step1.data.map((i) => i.title)).toEqual(
        step3.data.map((i) => i.title)
      );
      // step2 should be a sorted subset
      expect(step2.data.length).toBeLessThan(step1.data.length);
      const step2Titles = step2.data.map((i) => i.title);
      for (let i = 0; i < step2Titles.length - 1; i++) {
        expect(
          step2Titles[i].localeCompare(step2Titles[i + 1])
        ).toBeLessThanOrEqual(0);
      }
    });

    test('facet filter does not reset sort direction — desc stays desc', async () => {
      const [ascResult, descResult] = await Promise.all([
        mediaItemRepository.items({
          userId: user1.id,
          page: 1,
          orderBy: 'title',
          sortOrder: 'asc',
          genres: 'Sci-Fi',
        }),
        mediaItemRepository.items({
          userId: user1.id,
          page: 1,
          orderBy: 'title',
          sortOrder: 'desc',
          genres: 'Sci-Fi',
        }),
      ]);

      const ascTitles = ascResult.data.map((i) => i.title);
      const descTitles = descResult.data.map((i) => i.title);

      // Same items, reversed order
      expect(ascTitles).toEqual([...descTitles].reverse());
    });
  });

  // ─── 11. Cross-type navigation param behavior ────────────────────

  describe('cross-type navigation param forwarding', () => {
    test('genres carry forward between media types', async () => {
      // On movies page with genres=Action
      const moviesWithAction = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'movie',
        genres: 'Action',
      });

      // Navigate to all items (Watchlist-like view) keeping genres=Action
      const allWithAction = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Action',
      });

      // All items should include non-movie Action items too
      const allTitles = allWithAction.map((i) => i.title);
      expect(allTitles).toContain('Elden Ring'); // Action RPG game
      // Movie results are a subset
      expect(
        moviesWithAction.every((m) =>
          allWithAction.find((a) => a.title === m.title)
        )
      ).toBe(true);
    });

    test('year range carries forward between types', async () => {
      // Year range 2015-2020 on movies page
      const movieResult = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'movie',
        yearMin: 2015,
        yearMax: 2020,
      });

      // Same year range on TV page
      const tvResult = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'tv',
        yearMin: 2015,
        yearMax: 2020,
      });

      // Each scoped to its type but same year range
      expect(movieResult.every((i) => i.mediaType === 'movie')).toBe(true);
      expect(tvResult.every((i) => i.mediaType === 'tv')).toBe(true);

      // Verify the range constraint works for both types
      const allTitles = [...movieResult, ...tvResult].map((i) => i.title);
      expect(allTitles).toContain('Lucy'); // movie 2019
      expect(allTitles).toContain('Alternate SciFi Show'); // tv 2020
      expect(allTitles).not.toContain('Inception'); // movie 2010
    });

    test('creators are type-specific — not carried forward', async () => {
      // Director on movies page
      const moviesByNolan = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'movie',
        creators: 'Christopher Nolan',
      });

      // On TV page, Nolan is not a TV creator — returns nothing
      const tvByNolan = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'tv',
        creators: 'Christopher Nolan',
      });

      expect(moviesByNolan.length).toBe(2); // Inception + Interstellar
      expect(tvByNolan.length).toBe(0); // No TV shows by Nolan
    });

    test('publishers are type-specific — only relevant for games', async () => {
      // Publisher filter on games
      const gamesResult = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'video_game',
        publishers: 'CD Projekt',
      });
      expect(gamesResult.length).toBe(1);

      // Same publisher filter on movies — no matches (movies don't have publishers)
      const moviesResult = await mediaItemRepository.items({
        userId: user1.id,
        mediaType: 'movie',
        publishers: 'CD Projekt',
      });
      expect(moviesResult.length).toBe(0);
    });
  });

  // ─── 12. URL params bookmarkability (state restoration) ───────────

  describe('URL params bookmarkability — full state restoration', () => {
    test('complex filter set produces identical results when re-applied', async () => {
      const params = {
        userId: user1.id,
        genres: 'Action,Sci-Fi',
        yearMin: 2000,
        yearMax: 2020,
        languages: 'en',
        ratingMin: 8.0,
      };

      // First load
      const firstLoad = await mediaItemRepository.items(params);

      // Second load (simulating bookmark/reload with same params)
      const secondLoad = await mediaItemRepository.items(params);

      // Identical results
      const firstTitles = firstLoad.map((i) => i.title).sort();
      const secondTitles = secondLoad.map((i) => i.title).sort();
      expect(firstTitles).toEqual(secondTitles);
    });

    test('paginated results with facets are deterministic', async () => {
      const params = {
        userId: user1.id,
        page: 1,
        orderBy: 'title' as const,
        sortOrder: 'asc' as const,
        genres: 'Drama',
      };

      const firstLoad = await mediaItemRepository.items(params);
      const secondLoad = await mediaItemRepository.items(params);

      expect(firstLoad.data.map((i) => i.title)).toEqual(
        secondLoad.data.map((i) => i.title)
      );
      expect(firstLoad.total).toBe(secondLoad.total);
      expect(firstLoad.totalPages).toBe(secondLoad.totalPages);
    });

    test('facet counts are consistent with item results', async () => {
      const params = {
        userId: user1.id,
        genres: 'Action',
      };

      const items = await mediaItemRepository.items(params);
      const facets = await mediaItemRepository.facets(params);

      // Total items from mediaTypes counts should equal total items returned
      const totalFromFacets = facets.mediaTypes.reduce(
        (sum, mt) => sum + mt.count,
        0
      );
      expect(totalFromFacets).toBe(items.length);
    });
  });

  // ─── 13. Parallel facet + items queries ───────────────────────────

  describe('parallel facet + items API queries', () => {
    test('facets and items can be queried in parallel with same params', async () => {
      const params = {
        userId: user1.id,
        genres: 'Sci-Fi',
        yearMin: 2010,
      };

      const [items, facets] = await Promise.all([
        mediaItemRepository.items(params),
        mediaItemRepository.facets(params),
      ]);

      // Both resolve successfully
      expect(items.length).toBeGreaterThan(0);
      expect(facets.genres.length).toBeGreaterThan(0);

      // Counts are consistent
      const totalFromFacets = facets.mediaTypes.reduce(
        (sum, mt) => sum + mt.count,
        0
      );
      expect(totalFromFacets).toBe(items.length);
    });

    test('multiple parallel queries with different params all succeed', async () => {
      const [items1, facets1, items2, facets2] = await Promise.all([
        mediaItemRepository.items({
          userId: user1.id,
          genres: 'Action',
        }),
        mediaItemRepository.facets({
          userId: user1.id,
          genres: 'Action',
        }),
        mediaItemRepository.items({
          userId: user1.id,
          mediaType: 'tv',
        }),
        mediaItemRepository.facets({
          userId: user1.id,
          mediaType: 'tv',
        }),
      ]);

      // All resolve without errors
      expect(items1.length).toBeGreaterThan(0);
      expect(facets1.genres.length).toBeGreaterThan(0);
      expect(items2.length).toBeGreaterThan(0);
      expect(facets2.genres.length).toBeGreaterThan(0);
    });
  });

  // ─── 14. User-scoping prevents cross-user data leakage ───────────

  describe('user-scoping prevents data leakage', () => {
    test('user1 never sees user2-only items in any filter combination', async () => {
      // Unfiltered
      const allItems = await mediaItemRepository.items({
        userId: user1.id,
      });
      expect(allItems.find((i) => i.title === 'Secret Movie')).toBeUndefined();

      // Filtered by the genre of user2's item
      const thrillerItems = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Thriller',
      });
      expect(thrillerItems.length).toBe(0);

      // Facets never include user2's data
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });
      const allGenres = facets.genres.map((g) => g.value);
      expect(allGenres).not.toContain('Thriller');
      const allLangs = facets.languages.map((l) => l.value);
      expect(allLangs).not.toContain('es');
    });

    test('user2 only sees their own items', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user2.id,
      });

      expect(facets.genres.length).toBe(1);
      expect(facets.genres[0].value).toBe('Thriller');
      expect(facets.languages.length).toBe(1);
      expect(facets.languages[0].value).toBe('es');

      const mtMap = new Map(
        facets.mediaTypes.map((m) => [m.value, m.count])
      );
      expect(mtMap.get('movie')).toBe(1);
      expect(mtMap.size).toBe(1); // only movie type
    });
  });

  // ─── 15. Backward compatibility ──────────────────────────────────

  describe('backward compatibility', () => {
    test('legacy filter param still works for title search', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        filter: 'Inception',
      });

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Inception');
    });

    test('legacy singular genre param works independently', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        genre: 'Comedy',
      });

      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Lucy');
    });

    test('legacy filter + new facets can coexist', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        filter: 'Inception',
        ratingMin: 8.0,
      });

      // Inception matches both filter=Inception AND ratingMin=8.0 (it has 9.0)
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Inception');
    });

    test('empty/absent new params do not change existing behavior', async () => {
      const withoutParams = await mediaItemRepository.items({
        userId: user1.id,
      });
      const withEmptyGenres = await mediaItemRepository.items({
        userId: user1.id,
        genres: '',
      });

      expect(withoutParams.length).toBe(withEmptyGenres.length);
    });
  });

  // ─── 16. Edge cases and comprehensive scenarios ───────────────────

  describe('edge cases', () => {
    test('applying all facet dimensions simultaneously works', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Action',
        languages: 'en',
        yearMin: 2010,
        yearMax: 2015,
        ratingMin: 8.0,
        ratingMax: 10.0,
        status: 'seen',
      });

      // Action + en + 2010-2015 + rating 8.0-10.0 + seen
      // Inception: Action ✓, en ✓, 2010 ✓, 9.0 ✓, seen ✓ → match
      // Lucy: Action ✓, fr ✗ → no
      // Interstellar: Sci-Fi (no Action directly, but has Drama,Sci-Fi) ✗ → no
      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      // Most items excluded by the tight combined filters
    });

    test('non-matching filter combination returns empty results', async () => {
      const items = await mediaItemRepository.items({
        userId: user1.id,
        genres: 'Horror', // no Horror items in user1's library
      });

      expect(items.length).toBe(0);
    });

    test('non-matching filter combination returns empty facets', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        genres: 'Horror',
      });

      expect(facets.genres.length).toBe(0);
      expect(facets.years.length).toBe(0);
      expect(facets.languages.length).toBe(0);
      expect(facets.creators.length).toBe(0);
    });

    test('facet counts sorted descending in all dimensions', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      for (const dimension of [
        facets.genres,
        facets.years,
        facets.languages,
        facets.creators,
        facets.publishers,
        facets.mediaTypes,
      ]) {
        for (let i = 0; i < dimension.length - 1; i++) {
          expect(dimension[i].count).toBeGreaterThanOrEqual(
            dimension[i + 1].count
          );
        }
      }
    });

    test('total library count matches sum of mediaType facet counts', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });
      const items = await mediaItemRepository.items({
        userId: user1.id,
      });

      const totalFromFacets = facets.mediaTypes.reduce(
        (sum, mt) => sum + mt.count,
        0
      );
      expect(totalFromFacets).toBe(items.length);
      expect(totalFromFacets).toBe(10); // user1 has 10 items
    });
  });
});
