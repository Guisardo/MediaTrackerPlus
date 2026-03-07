import { ListSortBy, ListItem, listItemColumns } from 'src/entity/list';

describe('list entity types', () => {
  describe('ListSortBy type', () => {
    test("'recommended' is an accepted ListSortBy value", () => {
      const sortOptions: ListSortBy[] = [
        'my-rating',
        'recently-added',
        'recently-watched',
        'recently-aired',
        'next-airing',
        'release-date',
        'runtime',
        'title',
        'recommended',
      ];

      // This test verifies that all expected sort options are valid ListSortBy values
      // If any option is not in the union type, TypeScript will fail this test
      expect(sortOptions).toHaveLength(9);
      expect(sortOptions).toContain('recommended');
    });

    test('ListSortBy includes all original sort options', () => {
      const expectedOptions: ListSortBy[] = [
        'my-rating',
        'recently-added',
        'recently-watched',
        'recently-aired',
        'next-airing',
        'release-date',
        'runtime',
        'title',
      ];

      expectedOptions.forEach((option) => {
        // TypeScript will enforce that each option is a valid ListSortBy
        const sortBy: ListSortBy = option;
        expect(sortBy).toBe(option);
      });
    });
  });

  describe('ListItem type', () => {
    test('ListItem accepts estimatedRating as optional number', () => {
      const itemWithoutRating: ListItem = {
        id: 1,
        listId: 1,
        mediaItemId: 1,
        addedAt: Date.now(),
      };

      expect(itemWithoutRating).toEqual({
        id: 1,
        listId: 1,
        mediaItemId: 1,
        addedAt: expect.any(Number),
      });
    });

    test('ListItem can have estimatedRating field', () => {
      const itemWithRating: ListItem = {
        id: 2,
        listId: 1,
        mediaItemId: 2,
        addedAt: Date.now(),
        estimatedRating: 7.5,
      };

      expect(itemWithRating.estimatedRating).toBe(7.5);
    });

    test('ListItem estimatedRating supports various numeric values', () => {
      const ratingValues = [0, 5.5, 7.0, 9.8, 10];

      ratingValues.forEach((rating) => {
        const item: ListItem = {
          id: 1,
          listId: 1,
          mediaItemId: 1,
          addedAt: Date.now(),
          estimatedRating: rating,
        };

        expect(item.estimatedRating).toBe(rating);
      });
    });

    test('ListItem can have optional seasonId and episodeId', () => {
      const episodeItem: ListItem = {
        id: 1,
        listId: 1,
        mediaItemId: 1,
        seasonId: 2,
        episodeId: 3,
        addedAt: Date.now(),
        estimatedRating: 8.0,
      };

      expect(episodeItem.seasonId).toBe(2);
      expect(episodeItem.episodeId).toBe(3);
      expect(episodeItem.estimatedRating).toBe(8.0);
    });
  });

  describe('listItemColumns constant', () => {
    test('listItemColumns includes estimatedRating', () => {
      expect(listItemColumns).toContain('estimatedRating');
    });

    test('listItemColumns includes all required columns', () => {
      const requiredColumns = [
        'id',
        'listId',
        'mediaItemId',
        'seasonId',
        'episodeId',
        'estimatedRating',
      ];

      requiredColumns.forEach((column) => {
        expect(listItemColumns).toContain(column as any);
      });
    });

    test('listItemColumns has correct length', () => {
      expect(listItemColumns).toHaveLength(6);
    });
  });
});
