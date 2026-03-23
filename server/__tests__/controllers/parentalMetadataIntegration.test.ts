import { ItemsController } from 'src/controllers/items';
import { MediaItemController } from 'src/controllers/item';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { mediaItemRepository } from 'src/repository/mediaItem';
import {
  serializeDescriptors,
  serializeCategories,
} from 'src/metadata/parentalMetadata';
import { ParentalGuidanceCategory } from 'src/entity/mediaItem';

/**
 * Integration tests for canonical parental metadata fields.
 *
 * Verifies:
 * - DB migration creates the columns
 * - Repository serialize/deserialize roundtrip for structured fields
 * - Items endpoint returns parental metadata
 * - Details endpoint returns parental metadata
 * - Existing items with null parental fields remain valid
 */
describe('Parental Metadata Integration', () => {
  const PARENTAL_MOVIE_ID = 100;
  const NULL_PARENTAL_MOVIE_ID = 101;

  const descriptors = ['Violence', 'Language', 'Drug Use'];
  const categories: ParentalGuidanceCategory[] = [
    { category: 'Violence', severity: 'Moderate', description: 'Action sequences with mild violence' },
    { category: 'Language', severity: 'Mild' },
  ];

  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);

    // Movie with full parental metadata
    await Database.knex('mediaItem').insert({
      id: PARENTAL_MOVIE_ID,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Rated R Movie',
      minimumAge: 17,
      contentRatingSystem: 'MPAA',
      contentRatingRegion: 'US',
      contentRatingLabel: 'R',
      contentRatingDescriptors: serializeDescriptors(descriptors),
      parentalGuidanceSummary: 'Contains violence and strong language.',
      parentalGuidanceCategories: serializeCategories(categories),
    });

    // Movie with all parental fields null (simulates existing items)
    await Database.knex('mediaItem').insert({
      id: NULL_PARENTAL_MOVIE_ID,
      lastTimeUpdated: Date.now(),
      mediaType: 'movie',
      source: 'tmdb',
      title: 'Unrated Movie',
    });

    // Add both to watchlist so they appear in items queries
    const now = Date.now();
    await Database.knex('listItem').insert([
      { listId: Data.watchlist.id, mediaItemId: PARENTAL_MOVIE_ID, addedAt: now },
      { listId: Data.watchlist.id, mediaItemId: NULL_PARENTAL_MOVIE_ID, addedAt: now },
    ]);
  });

  afterAll(clearDatabase);

  // ---------------------------------------------------------------------------
  // Repository roundtrip
  // ---------------------------------------------------------------------------

  describe('repository serialize/deserialize', () => {
    test('roundtrips parental metadata through repository', async () => {
      const item = await mediaItemRepository.findOne({ id: PARENTAL_MOVIE_ID });

      expect(item).toBeDefined();
      expect(item!.minimumAge).toBe(17);
      expect(item!.contentRatingSystem).toBe('MPAA');
      expect(item!.contentRatingRegion).toBe('US');
      expect(item!.contentRatingLabel).toBe('R');
      expect(item!.contentRatingDescriptors).toEqual(descriptors);
      expect(item!.parentalGuidanceSummary).toBe(
        'Contains violence and strong language.'
      );
      expect(item!.parentalGuidanceCategories).toEqual(categories);
    });

    test('existing items with null parental fields remain valid', async () => {
      const item = await mediaItemRepository.findOne({
        id: NULL_PARENTAL_MOVIE_ID,
      });

      expect(item).toBeDefined();
      expect(item!.title).toBe('Unrated Movie');
      expect(item!.minimumAge).toBeNull();
      expect(item!.contentRatingSystem).toBeNull();
      expect(item!.contentRatingRegion).toBeNull();
      expect(item!.contentRatingLabel).toBeNull();
      expect(item!.contentRatingDescriptors).toBeNull();
      expect(item!.parentalGuidanceSummary).toBeNull();
      expect(item!.parentalGuidanceCategories).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Items endpoint
  // ---------------------------------------------------------------------------

  describe('GET /api/items', () => {
    test('items response includes parental fields for rated movie', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const ratedItem = items.find((i: any) => i.id === PARENTAL_MOVIE_ID);

      expect(ratedItem).toBeDefined();
      expect(ratedItem.minimumAge).toBe(17);
      expect(ratedItem.contentRatingSystem).toBe('MPAA');
      expect(ratedItem.contentRatingRegion).toBe('US');
      expect(ratedItem.contentRatingLabel).toBe('R');
      expect(ratedItem.contentRatingDescriptors).toEqual(descriptors);
      expect(ratedItem.parentalGuidanceSummary).toBe(
        'Contains violence and strong language.'
      );
      expect(ratedItem.parentalGuidanceCategories).toEqual(categories);
    });

    test('items response has null parental fields for unrated movie', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.get, {
        userId: Data.user.id,
        requestQuery: { mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const items = res.data as any[];
      const unratedItem = items.find(
        (i: any) => i.id === NULL_PARENTAL_MOVIE_ID
      );

      expect(unratedItem).toBeDefined();
      expect(unratedItem.minimumAge).toBeNull();
      expect(unratedItem.contentRatingSystem).toBeNull();
      expect(unratedItem.contentRatingLabel).toBeNull();
      expect(unratedItem.contentRatingDescriptors).toBeNull();
      expect(unratedItem.parentalGuidanceSummary).toBeNull();
      expect(unratedItem.parentalGuidanceCategories).toBeNull();
    });

    test('paginated items response includes parental fields', async () => {
      const itemsController = new ItemsController();

      const res = await request(itemsController.getPaginated, {
        userId: Data.user.id,
        requestQuery: { page: 1, mediaType: 'movie' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      const ratedItem = data.data.find(
        (i: any) => i.id === PARENTAL_MOVIE_ID
      );

      expect(ratedItem).toBeDefined();
      expect(ratedItem.minimumAge).toBe(17);
      expect(ratedItem.contentRatingSystem).toBe('MPAA');
    });
  });

  // ---------------------------------------------------------------------------
  // Details endpoint
  // ---------------------------------------------------------------------------

  describe('GET /api/details/:mediaItemId', () => {
    test('details response includes parental fields for rated movie', async () => {
      const itemController = new MediaItemController();

      const res = await request(itemController.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: PARENTAL_MOVIE_ID },
      });

      expect(res.statusCode).toBe(200);
      const detail = res.data as any;

      expect(detail.minimumAge).toBe(17);
      expect(detail.contentRatingSystem).toBe('MPAA');
      expect(detail.contentRatingRegion).toBe('US');
      expect(detail.contentRatingLabel).toBe('R');
      expect(detail.contentRatingDescriptors).toEqual(descriptors);
      expect(detail.parentalGuidanceSummary).toBe(
        'Contains violence and strong language.'
      );
      expect(detail.parentalGuidanceCategories).toEqual(categories);
    });

    test('details response has null parental fields for unrated movie', async () => {
      const itemController = new MediaItemController();

      const res = await request(itemController.details, {
        userId: Data.user.id,
        pathParams: { mediaItemId: NULL_PARENTAL_MOVIE_ID },
      });

      expect(res.statusCode).toBe(200);
      const detail = res.data as any;

      expect(detail.minimumAge).toBeNull();
      expect(detail.contentRatingSystem).toBeNull();
      expect(detail.contentRatingLabel).toBeNull();
      expect(detail.contentRatingDescriptors).toBeNull();
      expect(detail.parentalGuidanceSummary).toBeNull();
      expect(detail.parentalGuidanceCategories).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Repository update roundtrip
  // ---------------------------------------------------------------------------

  describe('repository update', () => {
    afterEach(async () => {
      // Reset parental fields on the null-parental movie after each test
      await Database.knex('mediaItem')
        .where('id', NULL_PARENTAL_MOVIE_ID)
        .update({
          minimumAge: null,
          contentRatingSystem: null,
          contentRatingRegion: null,
          contentRatingLabel: null,
          contentRatingDescriptors: null,
          parentalGuidanceSummary: null,
          parentalGuidanceCategories: null,
        });
    });

    test('update persists parental metadata via repository', async () => {
      const newCategories: ParentalGuidanceCategory[] = [
        { category: 'Nudity', severity: 'Severe' },
      ];

      await Database.knex('mediaItem')
        .where('id', NULL_PARENTAL_MOVIE_ID)
        .update({
          minimumAge: 18,
          contentRatingSystem: 'BBFC',
          contentRatingRegion: 'GB',
          contentRatingLabel: '18',
          contentRatingDescriptors: serializeDescriptors(['Nudity']),
          parentalGuidanceSummary: 'Contains strong nudity.',
          parentalGuidanceCategories: serializeCategories(newCategories),
        });

      const item = await mediaItemRepository.findOne({
        id: NULL_PARENTAL_MOVIE_ID,
      });

      expect(item).toBeDefined();
      expect(item!.minimumAge).toBe(18);
      expect(item!.contentRatingSystem).toBe('BBFC');
      expect(item!.contentRatingRegion).toBe('GB');
      expect(item!.contentRatingLabel).toBe('18');
      expect(item!.contentRatingDescriptors).toEqual(['Nudity']);
      expect(item!.parentalGuidanceSummary).toBe('Contains strong nudity.');
      expect(item!.parentalGuidanceCategories).toEqual(newCategories);
    });
  });
});
