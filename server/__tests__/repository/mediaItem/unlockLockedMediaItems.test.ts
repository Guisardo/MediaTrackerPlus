import _ from 'lodash';

import { Database } from 'src/dbconfig';
import { MediaItemBase } from 'src/entity/mediaItem';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { clearDatabase, runMigrations } from '../../__utils__/utils';

const now = new Date('2026-03-29T12:00:00.000Z').getTime();
const mediaItems: MediaItemBase[] = [
  {
    id: 0,
    title: 'title 0',
    mediaType: 'movie',
    source: 'user',
    lockedAt: now - 24 * 60 * 60 * 1000,
  },
  {
    id: 1,
    title: 'title 1',
    mediaType: 'movie',
    source: 'user',
  },
  {
    id: 2,
    title: 'title 2',
    mediaType: 'movie',
    source: 'user',
    lockedAt: now - 23 * 60 * 60 * 1000,
  },
  {
    id: 3,
    title: 'title 3',
    mediaType: 'movie',
    source: 'user',
    lockedAt: now,
  },
];

describe('unlockLockedMediaItems.test', () => {
  beforeAll(async () => {
    await runMigrations();
    await Database.knex('mediaItem').delete();
    await Database.knex('mediaItem').insert(mediaItems);
  });

  afterAll(clearDatabase);
  afterEach(() => jest.useRealTimers());

  test('should unlock only items locked 24 hours earlier or more', async () => {
    jest.useFakeTimers({ doNotFake: ['performance'] });
    jest.setSystemTime(now);

    const res = await mediaItemRepository.unlockLockedMediaItems();

    expect(res).toEqual(1);

    const updatedMediaItems = await Database.knex('mediaItem').orderBy(
      'id',
      'asc'
    );

    expect(
      updatedMediaItems.map((item) => ({
        id: item.id,
        lockedAt: item.lockedAt,
      }))
    ).toEqual([
      {
        id: 0,
        lockedAt: null,
      },
      {
        id: 1,
        lockedAt: null,
      },
      {
        id: 2,
        lockedAt: mediaItems[2].lockedAt,
      },
      {
        id: 3,
        lockedAt: mediaItems[3].lockedAt,
      },
    ]);
  });
});
