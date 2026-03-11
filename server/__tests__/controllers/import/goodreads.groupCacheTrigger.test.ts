/**
 * US-007: Tests that Goodreads import triggers recalculateGroupPlatformRatingsForUser
 * via setImmediate for all rated media items.
 */

// Mock only groupPlatformRatingCache — let mediaItemRepository use the real DB implementation
jest.mock('src/repository/groupPlatformRatingCache', () => ({
  recalculateGroupPlatformRatingsForUser: jest
    .fn()
    .mockResolvedValue(undefined),
  recalculateGroupPlatformRating: jest.fn().mockResolvedValue(undefined),
  recalculateAllGroupPlatformRatings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('axios');

import axios from 'axios';
import { importFromGoodreadsRss } from 'src/controllers/import/goodreads';
import { recalculateGroupPlatformRatingsForUser } from 'src/repository/groupPlatformRatingCache';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import GoodReadsXML from './goodreads.xml';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedRecalculateGroup =
  recalculateGroupPlatformRatingsForUser as jest.MockedFunction<
    typeof recalculateGroupPlatformRatingsForUser
  >;

describe('Goodreads import: group cache trigger', () => {
  beforeAll(runMigrations);
  afterAll(clearDatabase);

  beforeAll(async () => {
    await Database.knex('user').insert(Data.user);
    await Database.knex('list').insert(Data.watchlist);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: GoodReadsXML });
  });

  it('should schedule recalculateGroupPlatformRatingsForUser via setImmediate for rated mediaItems after Goodreads import', async () => {
    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    let result: Awaited<ReturnType<typeof importFromGoodreadsRss>>;
    try {
      result = await importFromGoodreadsRss(
        'https://example.com/goodreads.xml',
        Data.user.id
      );
      // Should have exactly 2 setImmediate calls: platformRating + groupPlatformRating
      expect(capturedCallbacks.length).toBe(2);
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    expect(result.ratings).toBeGreaterThan(0);

    // Execute captured callbacks to confirm group recalculation is triggered
    for (const cb of capturedCallbacks) {
      await cb();
    }

    expect(mockedRecalculateGroup).toHaveBeenCalled();
    // Verify the correct userId is passed on all calls
    const groupCalls = mockedRecalculateGroup.mock.calls;
    expect(groupCalls.length).toBeGreaterThan(0);
    for (const [calledUserId] of groupCalls) {
      expect(calledUserId).toBe(Data.user.id);
    }
  });

  it('should NOT schedule recalculateGroupPlatformRatingsForUser when import has no ratings', async () => {
    // Two items with user_rating=0 — fast-xml-parser returns an array for 2+ items.
    // Rating of 0 is filtered out by goodreads.ts (line: filter item.user_rating || item.user_review),
    // so the rating array will be empty and no setImmediate for group cache should be called.
    const noRatingFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Empty Goodreads</title><link>https://goodreads.com</link>
<item><title>Book One</title><book_id>111</book_id><author_name>Author One</author_name><user_rating>0</user_rating><user_shelves>to-read</user_shelves><user_date_added>Mon Jan 01 00:00:00 -0000 2024</user_date_added></item>
<item><title>Book Two</title><book_id>222</book_id><author_name>Author Two</author_name><user_rating>0</user_rating><user_shelves>to-read</user_shelves><user_date_added>Mon Jan 01 00:00:00 -0000 2024</user_date_added></item>
</channel></rss>`;
    mockedAxios.get.mockResolvedValue({ data: noRatingFeed });

    const originalSetImmediate = global.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    global.setImmediate = jest.fn((callback) => {
      capturedCallbacks.push(callback as () => void);
    }) as unknown as typeof setImmediate;

    try {
      await importFromGoodreadsRss(
        'https://example.com/no-ratings.xml',
        Data.user.id
      );
    } finally {
      global.setImmediate = originalSetImmediate;
    }

    for (const cb of capturedCallbacks) {
      await cb();
    }

    // With 0-star ratings filtered out, there should be no group cache trigger
    expect(mockedRecalculateGroup).not.toHaveBeenCalled();
  });
});
