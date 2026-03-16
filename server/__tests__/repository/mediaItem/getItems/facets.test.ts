import { mediaItemRepository } from 'src/repository/mediaItem';
import { MediaItemBase } from 'src/entity/mediaItem';
import { User } from 'src/entity/user';
import { userRepository } from 'src/repository/user';
import { clearDatabase, runMigrations } from '../../../__utils__/utils';
import { listItemRepository } from 'src/repository/listItemRepository';
import { seenRepository } from 'src/repository/seen';
import { userRatingRepository } from 'src/repository/userRating';

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

// Movie: Action,Sci-Fi, en, director: Christopher Nolan, rating 9.0, year 2010
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

// Movie: Comedy,Action, fr, director: Luc Besson, rating 7.5, year 2019
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

// TV: Drama,Crime, en, creator: Vince Gilligan, rating 9.5, year 2008
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
  releaseDate: '2008-01-20',
};

// Game: RPG, en, developer: CD Projekt Red, publisher: CD Projekt, no rating, year 2015
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

// Book: Science Fiction, en, authors: Frank Herbert, rating 5.0, year 2000
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

// Audiobook: Fantasy, de, authors: Patrick Rothfuss, rating 8.0, year 2007
const audiobook1: MediaItemBase = {
  id: 6,
  lastTimeUpdated: new Date().getTime(),
  mediaType: 'audiobook',
  source: 'user',
  title: 'The Name of the Wind',
  genres: ['Fantasy'],
  language: 'de',
  authors: ['Patrick Rothfuss'],
  tmdbRating: 8.0,
  releaseDate: '2007-03-27',
};

// Movie only in user2's library (for user-scoping test)
const movie3: MediaItemBase = {
  id: 7,
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

describe('facets', () => {
  beforeAll(async () => {
    await runMigrations();
    await userRepository.create(user1);
    await userRepository.create(user2);
    await mediaItemRepository.createMany([
      movie1,
      movie2,
      tvShow1,
      game1,
      book1,
      audiobook1,
      movie3,
    ]);

    // Add items to user1's library
    await addToWatchlistAndSeen(user1.id, movie1.id!, true, true);
    await addToWatchlistAndSeen(user1.id, movie2.id!, true, true);
    await addToWatchlistAndSeen(user1.id, tvShow1.id!, true, true);
    await addToWatchlistAndSeen(user1.id, game1.id!, true, false);
    await addToWatchlistAndSeen(user1.id, book1.id!, true, true);
    await addToWatchlistAndSeen(user1.id, audiobook1.id!, true, true);

    // Add movie3 to user2's library ONLY
    await addToWatchlistAndSeen(user2.id, movie3.id!, true, true);
  });

  afterAll(clearDatabase);

  describe('response shape', () => {
    test('returns all 6 facet dimensions', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      expect(facets).toHaveProperty('genres');
      expect(facets).toHaveProperty('years');
      expect(facets).toHaveProperty('languages');
      expect(facets).toHaveProperty('creators');
      expect(facets).toHaveProperty('publishers');
      expect(facets).toHaveProperty('mediaTypes');
    });

    test('each dimension is an array of { value, count } objects', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      for (const genre of facets.genres) {
        expect(genre).toHaveProperty('value');
        expect(genre).toHaveProperty('count');
        expect(typeof genre.value).toBe('string');
        expect(typeof genre.count).toBe('number');
      }
    });

    test('each dimension sorted by count descending', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      for (const dimension of [
        facets.genres,
        facets.years,
        facets.languages,
        facets.creators,
        facets.mediaTypes,
      ]) {
        for (let i = 0; i < dimension.length - 1; i++) {
          expect(dimension[i].count).toBeGreaterThanOrEqual(
            dimension[i + 1].count
          );
        }
      }
    });
  });

  describe('genres aggregation', () => {
    test('counts each genre from CSV field correctly', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const genreMap = new Map(
        facets.genres.map((g) => [g.value, g.count])
      );

      // Action appears in movie1 (Action,Sci-Fi) and movie2 (Comedy,Action) = 2
      expect(genreMap.get('Action')).toBe(2);
      // Sci-Fi appears in movie1 only = 1
      expect(genreMap.get('Sci-Fi')).toBe(1);
      // Comedy appears in movie2 only = 1
      expect(genreMap.get('Comedy')).toBe(1);
      // Drama appears in tvShow1 = 1
      expect(genreMap.get('Drama')).toBe(1);
      // RPG appears in game1 = 1
      expect(genreMap.get('RPG')).toBe(1);
    });

    test('does not include zero count genres', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      for (const genre of facets.genres) {
        expect(genre.count).toBeGreaterThan(0);
      }
    });
  });

  describe('years aggregation', () => {
    test('extracts years from releaseDate correctly', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const yearValues = facets.years.map((y) => y.value);
      expect(yearValues).toContain('2010'); // movie1
      expect(yearValues).toContain('2019'); // movie2
      expect(yearValues).toContain('2008'); // tvShow1
      expect(yearValues).toContain('2015'); // game1
      expect(yearValues).toContain('2000'); // book1
      expect(yearValues).toContain('2007'); // audiobook1
    });

    test('does not include years from other users', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const yearValues = facets.years.map((y) => y.value);
      // 2022 is movie3's year, which belongs to user2 only
      expect(yearValues).not.toContain('2022');
    });
  });

  describe('languages aggregation', () => {
    test('counts language codes correctly', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const langMap = new Map(
        facets.languages.map((l) => [l.value, l.count])
      );

      // en: movie1, tvShow1, game1, book1 = 4
      expect(langMap.get('en')).toBe(4);
      // fr: movie2 = 1
      expect(langMap.get('fr')).toBe(1);
      // de: audiobook1 = 1
      expect(langMap.get('de')).toBe(1);
      // es should NOT be here (user2's movie only)
      expect(langMap.get('es')).toBeUndefined();
    });
  });

  describe('creators aggregation', () => {
    test('aggregates from director, creator, authors, developer', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const creatorMap = new Map(
        facets.creators.map((c) => [c.value, c.count])
      );

      // movie directors
      expect(creatorMap.get('Christopher Nolan')).toBe(1);
      expect(creatorMap.get('Luc Besson')).toBe(1);
      // TV creator
      expect(creatorMap.get('Vince Gilligan')).toBe(1);
      // Game developer
      expect(creatorMap.get('CD Projekt Red')).toBe(1);
      // Book author
      expect(creatorMap.get('Frank Herbert')).toBe(1);
      // Audiobook author
      expect(creatorMap.get('Patrick Rothfuss')).toBe(1);
      // user2's director not present
      expect(creatorMap.get('Secret Director')).toBeUndefined();
    });

    test('scoped by mediaType shows only relevant creators', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      const creatorValues = facets.creators.map((c) => c.value);
      expect(creatorValues).toContain('Christopher Nolan');
      expect(creatorValues).toContain('Luc Besson');
      // Non-movie creators should not appear
      expect(creatorValues).not.toContain('Vince Gilligan');
      expect(creatorValues).not.toContain('Frank Herbert');
    });
  });

  describe('publishers aggregation', () => {
    test('counts publishers when no mediaType specified', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const pubMap = new Map(
        facets.publishers.map((p) => [p.value, p.count])
      );

      expect(pubMap.get('CD Projekt')).toBe(1);
    });

    test('publishers included when mediaType=video_game', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'video_game',
      });

      expect(facets.publishers.length).toBeGreaterThan(0);
      expect(facets.publishers[0].value).toBe('CD Projekt');
    });

    test('publishers excluded when mediaType is not video_game', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      expect(facets.publishers).toEqual([]);
    });
  });

  describe('mediaTypes aggregation', () => {
    test('counts media types when no mediaType specified', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const mtMap = new Map(
        facets.mediaTypes.map((m) => [m.value, m.count])
      );

      expect(mtMap.get('movie')).toBe(2); // movie1, movie2
      expect(mtMap.get('tv')).toBe(1);
      expect(mtMap.get('video_game')).toBe(1);
      expect(mtMap.get('book')).toBe(1);
      expect(mtMap.get('audiobook')).toBe(1);
    });

    test('mediaTypes omitted when mediaType is specified (already scoped)', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      expect(facets.mediaTypes).toEqual([]);
    });
  });

  describe('mediaType scoping', () => {
    test('mediaType param scopes all facets to that type', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        mediaType: 'movie',
      });

      // Only movie genres should appear
      const genreValues = facets.genres.map((g) => g.value);
      expect(genreValues).toContain('Action');
      expect(genreValues).toContain('Sci-Fi');
      expect(genreValues).toContain('Comedy');
      expect(genreValues).not.toContain('Drama');
      expect(genreValues).not.toContain('RPG');

      // Only movie years
      const yearValues = facets.years.map((y) => y.value);
      expect(yearValues).toContain('2010');
      expect(yearValues).toContain('2019');
      expect(yearValues).not.toContain('2008');
      expect(yearValues).not.toContain('2015');
    });
  });

  describe('user-scoping (cross-user data leakage prevention)', () => {
    test('user1 does not see user2 items in facets', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const allValues = [
        ...facets.genres.map((g) => g.value),
        ...facets.languages.map((l) => l.value),
        ...facets.creators.map((c) => c.value),
      ];

      // movie3 belongs to user2 only
      expect(allValues).not.toContain('Thriller');
      expect(allValues).not.toContain('es');
      expect(allValues).not.toContain('Secret Director');
    });

    test('user2 only sees their own items', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user2.id,
      });

      const genreValues = facets.genres.map((g) => g.value);
      expect(genreValues).toContain('Thriller');
      expect(genreValues).not.toContain('Action');

      const langValues = facets.languages.map((l) => l.value);
      expect(langValues).toContain('es');
      expect(langValues).not.toContain('en');
    });
  });

  describe('zero-count exclusion', () => {
    test('all facet options have count > 0', async () => {
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
        for (const option of dimension) {
          expect(option.count).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('filter params affect facet counts', () => {
    test('genres filter narrows all facet counts', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        genres: 'Action',
      });

      // Only movie1 (Action,Sci-Fi) and movie2 (Comedy,Action) match
      const langMap = new Map(
        facets.languages.map((l) => [l.value, l.count])
      );
      expect(langMap.get('en')).toBe(1); // only movie1
      expect(langMap.get('fr')).toBe(1); // only movie2
      // de (audiobook1) and others excluded
      expect(langMap.get('de')).toBeUndefined();
    });

    test('yearMin/yearMax filter narrows facet counts', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        yearMin: 2015,
      });

      // Only movie2 (2019), game1 (2015) match
      const yearValues = facets.years.map((y) => y.value);
      expect(yearValues).toContain('2019');
      expect(yearValues).toContain('2015');
      expect(yearValues).not.toContain('2010'); // movie1
      expect(yearValues).not.toContain('2008'); // tvShow1
      expect(yearValues).not.toContain('2000'); // book1
    });

    test('ratingMin > 0 excludes items without rating', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        ratingMin: 1,
      });

      // game1 has no rating and should be excluded
      const mtMap = new Map(
        facets.mediaTypes.map((m) => [m.value, m.count])
      );
      expect(mtMap.get('video_game')).toBeUndefined();
    });

    test('status=rated narrows to rated items only', async () => {
      // First add a rating for movie1
      await userRatingRepository.create({
        id: 200,
        mediaItemId: movie1.id,
        userId: user1.id,
        rating: 8,
        date: new Date().getTime(),
      });

      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        status: 'rated',
      });

      // Only movie1 has a user rating
      expect(facets.genres.length).toBeGreaterThan(0);
      const genreValues = facets.genres.map((g) => g.value);
      expect(genreValues).toContain('Action');
      expect(genreValues).toContain('Sci-Fi');
      // Other genres from non-rated items should be absent
      expect(genreValues).not.toContain('Drama');
      expect(genreValues).not.toContain('RPG');
    });

    test('filter param narrows results by title search', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        filter: 'Inception',
      });

      // Only movie1 matches
      expect(facets.genres.length).toBe(2); // Action, Sci-Fi
      expect(facets.mediaTypes.length).toBe(1);
      expect(facets.mediaTypes[0].value).toBe('movie');
    });

    test('combined filters narrow facets with AND logic', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
        genres: 'Action',
        languages: 'en',
      });

      // Only movie1 matches (Action + en); movie2 is Action + fr
      expect(facets.creators.length).toBe(1);
      expect(facets.creators[0].value).toBe('Christopher Nolan');
    });
  });

  describe('count accuracy', () => {
    test('genre counts are accurate with multiple items sharing genres', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const genreMap = new Map(
        facets.genres.map((g) => [g.value, g.count])
      );

      // Action appears in both movie1 and movie2
      expect(genreMap.get('Action')).toBe(2);
      // All single-occurrence genres
      expect(genreMap.get('Crime')).toBe(1);
      expect(genreMap.get('Fantasy')).toBe(1);
      expect(genreMap.get('Science Fiction')).toBe(1);
    });

    test('total items in mediaTypes matches total library items', async () => {
      const facets = await mediaItemRepository.facets({
        userId: user1.id,
      });

      const totalCount = facets.mediaTypes.reduce(
        (sum, mt) => sum + mt.count,
        0
      );
      // user1 has 6 items
      expect(totalCount).toBe(6);
    });
  });
});
