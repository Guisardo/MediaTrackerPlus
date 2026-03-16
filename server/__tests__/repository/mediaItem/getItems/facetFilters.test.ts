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

// Movie with genre Action, language en, director Christopher Nolan, rating 9.0, year 2010
const movie1: MediaItemBase = {
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

// Movie with genre Comedy, language fr, director Luc Besson, rating 7.5, year 2019
const movie2: MediaItemBase = {
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

// TV show with creator, language en, year 2015
const tvShow1: MediaItemBase = {
  id: 3,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'tv',
  source: 'user',
  title: 'Breaking Bad',
  genres: ['Drama', 'Crime'],
  language: 'en',
  creator: 'Vince Gilligan',
  tmdbRating: 9.5,
  releaseDate: '2015-03-10',
};

// Game with publisher and developer, no rating
const game1: MediaItemBase = {
  id: 4,
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

// Book with authors, low rating, year 2000
const book1: MediaItemBase = {
  id: 5,
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

describe('facetFilters', () => {
  beforeAll(async () => {
    await runMigrations();
    await userRepository.create(user);
    await mediaItemRepository.createMany([movie1, movie2, tvShow1, game1, book1]);

    // Add all items to user's library (watchlist or seen)
    await addToWatchlistAndSeen(user.id, movie1.id!, true, true);
    await addToWatchlistAndSeen(user.id, movie2.id!, true, true);
    await addToWatchlistAndSeen(user.id, tvShow1.id!, true, true);
    await addToWatchlistAndSeen(user.id, game1.id!, true, false);
    await addToWatchlistAndSeen(user.id, book1.id!, true, true);
  });

  afterAll(clearDatabase);

  describe('genres (multi-value, OR logic)', () => {
    test('single genre filters correctly', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genres: 'Action',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Lucy');
      expect(titles).not.toContain('Breaking Bad');
      expect(titles).not.toContain('The Witcher 3');
    });

    test('multiple genres use OR logic within dimension', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genres: 'Drama,RPG',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Breaking Bad');
      expect(titles).toContain('The Witcher 3');
      expect(titles).not.toContain('Inception');
    });

    test('absent genres param returns all results', async () => {
      const items = await mediaItemRepository.items({ userId: user.id });
      expect(items.length).toStrictEqual(5);
    });

    test('existing singular genre param still works independently', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genre: 'Comedy',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Lucy');
      expect(items.length).toStrictEqual(1);
    });
  });

  describe('languages (multi-value, OR logic)', () => {
    test('single language filters correctly', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        languages: 'fr',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Lucy');
      expect(items.length).toStrictEqual(1);
    });

    test('multiple languages use OR logic', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        languages: 'en,fr',
      });

      // all items are en or fr
      expect(items.length).toStrictEqual(5);
    });

    test('absent languages param returns all results', async () => {
      const items = await mediaItemRepository.items({ userId: user.id });
      expect(items.length).toStrictEqual(5);
    });
  });

  describe('creators (multi-value, OR logic, searches director/creator/authors/developer)', () => {
    test('filters by director for movies', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        creators: 'Christopher Nolan',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).not.toContain('Lucy');
    });

    test('filters by creator for TV shows', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        creators: 'Vince Gilligan',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Breaking Bad');
      expect(titles).not.toContain('Inception');
    });

    test('filters by authors for books', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        creators: 'Frank Herbert',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Dune');
      expect(items.length).toStrictEqual(1);
    });

    test('filters by developer for games', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        creators: 'CD Projekt Red',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('The Witcher 3');
      expect(items.length).toStrictEqual(1);
    });

    test('multiple creators use OR logic across all creator fields', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        creators: 'Christopher Nolan,Vince Gilligan',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Breaking Bad');
      expect(items.length).toStrictEqual(2);
    });
  });

  describe('publishers (multi-value, OR logic, exact match)', () => {
    test('filters by publisher for games', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        publishers: 'CD Projekt',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('The Witcher 3');
      expect(items.length).toStrictEqual(1);
    });

    test('absent publishers param returns all results', async () => {
      const items = await mediaItemRepository.items({ userId: user.id });
      expect(items.length).toStrictEqual(5);
    });

    test('non-matching publisher returns no results', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        publishers: 'Unknown Publisher',
      });

      expect(items.length).toStrictEqual(0);
    });
  });

  describe('mediaTypes (multi-value, OR logic)', () => {
    test('single mediaType filters correctly', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        mediaTypes: 'movie',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Lucy');
      expect(titles).not.toContain('Breaking Bad');
      expect(items.length).toStrictEqual(2);
    });

    test('multiple mediaTypes use OR logic', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        mediaTypes: 'movie,tv',
      });

      const types = new Set(items.map((i) => i.mediaType));
      expect(types.has('movie')).toBeTruthy();
      expect(types.has('tv')).toBeTruthy();
      expect(types.has('video_game')).toBeFalsy();
      expect(items.length).toStrictEqual(3);
    });

    test('absent mediaTypes param returns all results', async () => {
      const items = await mediaItemRepository.items({ userId: user.id });
      expect(items.length).toStrictEqual(5);
    });
  });

  describe('yearMin and yearMax (inclusive bounds on releaseDate year)', () => {
    test('yearMin filters to items released at or after year', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        yearMin: 2015,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Breaking Bad');
      expect(titles).toContain('The Witcher 3');
      expect(titles).toContain('Lucy'); // 2019
      expect(titles).not.toContain('Inception'); // 2010
      expect(titles).not.toContain('Dune'); // 2000
    });

    test('yearMax filters to items released at or before year', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        yearMax: 2010,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception'); // 2010
      expect(titles).toContain('Dune'); // 2000
      expect(titles).not.toContain('Lucy'); // 2019
    });

    test('yearMin and yearMax together create inclusive range', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        yearMin: 2015,
        yearMax: 2015,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Breaking Bad'); // 2015
      expect(titles).toContain('The Witcher 3'); // 2015
      expect(titles).not.toContain('Lucy'); // 2019
      expect(titles).not.toContain('Inception'); // 2010
    });

    test('absent year params return all results', async () => {
      const items = await mediaItemRepository.items({ userId: user.id });
      expect(items.length).toStrictEqual(5);
    });
  });

  describe('ratingMin and ratingMax (inclusive bounds on tmdbRating)', () => {
    test('ratingMin > 0 excludes items with no tmdbRating', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        ratingMin: 1,
      });

      const titles = items.map((i) => i.title);
      expect(titles).not.toContain('The Witcher 3'); // no tmdbRating
    });

    test('ratingMin filters to items at or above minimum rating', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        ratingMin: 9.0,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception'); // 9.0
      expect(titles).toContain('Breaking Bad'); // 9.5
      expect(titles).not.toContain('Lucy'); // 7.5
      expect(titles).not.toContain('Dune'); // 5.0
    });

    test('ratingMax filters to items at or below maximum rating', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        ratingMax: 7.5,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Lucy'); // 7.5
      expect(titles).toContain('Dune'); // 5.0
      // game1 has no rating but ratingMax alone does not exclude nulls
      expect(titles).not.toContain('Inception'); // 9.0
    });

    test('ratingMin and ratingMax together create inclusive range', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        ratingMin: 7.0,
        ratingMax: 9.0,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception'); // 9.0
      expect(titles).toContain('Lucy'); // 7.5
      expect(titles).not.toContain('Breaking Bad'); // 9.5 - above max
      expect(titles).not.toContain('Dune'); // 5.0 - below min
    });

    test('absent rating params return all results', async () => {
      const items = await mediaItemRepository.items({ userId: user.id });
      expect(items.length).toStrictEqual(5);
    });
  });

  describe('status (comma-separated keys, AND logic)', () => {
    beforeAll(async () => {
      // Add user rating for movie1 to test 'rated' status
      await userRatingRepository.create({
        id: 100,
        mediaItemId: movie1.id,
        userId: user.id,
        rating: 8,
        date: new Date().getTime(),
      });
    });

    test('status=seen returns only seen items', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        status: 'seen',
      });

      // movie1, movie2, tvShow1, book1 were marked seen; game1 was not
      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Lucy');
      expect(titles).toContain('Breaking Bad');
      expect(titles).toContain('Dune');
      expect(titles).not.toContain('The Witcher 3');
    });

    test('status=watchlist returns only items on watchlist', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        status: 'watchlist',
      });

      // all items were added to watchlist
      expect(items.length).toStrictEqual(5);
    });

    test('status=rated returns only items with user rating', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        status: 'rated',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(items.length).toStrictEqual(1);
    });

    test('status=unrated returns only items without user rating', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        status: 'unrated',
      });

      const titles = items.map((i) => i.title);
      expect(titles).not.toContain('Inception'); // has rating
    });

    test('absent status param returns all results (legacy filter param still works)', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        filter: '',
      });
      expect(items.length).toStrictEqual(5);
    });
  });

  describe('combined filters (AND logic across dimensions)', () => {
    test('genres + mediaTypes combine with AND logic', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genres: 'Action',
        mediaTypes: 'movie',
      });

      // Only movies with Action genre
      const titles = items.map((i) => i.title);
      expect(titles).toContain('Inception');
      expect(titles).toContain('Lucy');
      expect(titles).not.toContain('Breaking Bad'); // TV show
    });

    test('genres + languages combine with AND logic', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genres: 'Action',
        languages: 'fr',
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Lucy'); // Action + fr
      expect(titles).not.toContain('Inception'); // Action + en (not fr)
      expect(items.length).toStrictEqual(1);
    });

    test('yearMin + genres combine with AND logic', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        genres: 'Action',
        yearMin: 2019,
      });

      const titles = items.map((i) => i.title);
      expect(titles).toContain('Lucy'); // Action + 2019
      expect(titles).not.toContain('Inception'); // Action + 2010 (before 2019)
    });

    test('empty/absent params do not change existing behavior', async () => {
      const allItems = await mediaItemRepository.items({ userId: user.id });
      const itemsWithEmptyGenres = await mediaItemRepository.items({
        userId: user.id,
        genres: '',
      });

      expect(allItems.length).toStrictEqual(itemsWithEmptyGenres.length);
    });
  });

  describe('backward compatibility', () => {
    test('existing singular genre param works alongside plural genres', async () => {
      // genre=Drama AND genres=Action should return items matching BOTH
      const items = await mediaItemRepository.items({
        userId: user.id,
        genre: 'Drama',
        genres: 'Crime',
      });

      const titles = items.map((i) => i.title);
      // Breaking Bad has both Drama and Crime
      expect(titles).toContain('Breaking Bad');
      expect(items.length).toStrictEqual(1);
    });

    test('legacy filter param continues to work when status param is absent', async () => {
      const items = await mediaItemRepository.items({
        userId: user.id,
        filter: 'Inception',
      });

      expect(items.length).toStrictEqual(1);
      expect(items[0].title).toStrictEqual('Inception');
    });
  });
});
