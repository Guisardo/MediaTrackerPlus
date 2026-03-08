import { Database } from 'src/dbconfig';
import { NotificationPlatformsCredentials } from 'src/entity/notificationPlatformsCredentials';
import { notificationPlatformsCredentialsRepository } from 'src/repository/notificationPlatformsCredentials';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * notificationPlatformsCredentialsRepository tests.
 *
 * The NotificationPlatformsCredentialsRepository extends the generic
 * repository and adds one custom method:
 *   - get(userId) — returns a nested object keyed by platformName, then by
 *                   credential name, mapping to the stored value.
 *
 * These tests verify:
 *   - create()   — stores credentials for a given user and platform
 *   - findOne()  — retrieves a single credential record
 *   - find()     — retrieves all credentials for a user
 *   - update()   — modifies stored credential values
 *   - delete()   — removes credential records
 *   - get()      — returns the structured credential map for a user
 *
 * Database prerequisites (inserted once in beforeAll):
 *   - user  (Data.user)
 *   - user2 (Data.user2) — for cross-user isolation tests
 */

describe('notificationPlatformsCredentialsRepository', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('notificationPlatformsCredentials').delete();
  });

  // ---------------------------------------------------------------------------
  // create — store credentials for a platform
  // ---------------------------------------------------------------------------

  describe('create (store credentials for a platform)', () => {
    test('inserts a credential entry and returns a numeric id', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'secret-gotify-token',
      });

      expect(typeof id).toBe('number');
    });

    test('the inserted row contains the correct fields', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'https://discord.com/api/webhooks/123/abc',
      });

      const row: NotificationPlatformsCredentials = await Database.knex(
        'notificationPlatformsCredentials'
      )
        .where({ id })
        .first();

      expect(row.userId).toBe(Data.user.id);
      expect(row.platformName).toBe('discord');
      expect(row.name).toBe('webhookUrl');
      expect(row.value).toBe('https://discord.com/api/webhooks/123/abc');
    });

    test('allows multiple credential keys for the same platform', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'token',
        value: 'pushover-token',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'userKey',
        value: 'pushover-user-key',
      });

      const rows: NotificationPlatformsCredentials[] = await Database.knex(
        'notificationPlatformsCredentials'
      ).where({ userId: Data.user.id, platformName: 'pushover' });

      expect(rows).toHaveLength(2);
      const names = rows.map((r) => r.name);
      expect(names).toContain('token');
      expect(names).toContain('userKey');
    });

    test('allows two different users to store credentials for the same platform', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user1-topic',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user2.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user2-topic',
      });

      const rows: NotificationPlatformsCredentials[] = await Database.knex(
        'notificationPlatformsCredentials'
      ).where({ platformName: 'ntfy', name: 'topic' });

      expect(rows).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — retrieve a single credential record
  // ---------------------------------------------------------------------------

  describe('findOne (retrieve a single credential record)', () => {
    test('returns the matching record when queried by id', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'my-gotify-token',
      });

      const found = await notificationPlatformsCredentialsRepository.findOne({
        id,
      });

      expect(found).toBeDefined();
      expect(found.id).toBe(id);
      expect(found.value).toBe('my-gotify-token');
    });

    test('returns the record when queried by userId, platformName and name', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'https://discord.example.com/hook',
      });

      const found = await notificationPlatformsCredentialsRepository.findOne({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
      });

      expect(found).toBeDefined();
      expect(found.platformName).toBe('discord');
      expect(found.name).toBe('webhookUrl');
      expect(found.value).toBe('https://discord.example.com/hook');
    });

    test('returns undefined when no matching record exists', async () => {
      const found = await notificationPlatformsCredentialsRepository.findOne({
        id: 999999,
      });

      expect(found).toBeUndefined();
    });

    test('returns undefined when querying for a platform the user has not configured', async () => {
      const found = await notificationPlatformsCredentialsRepository.findOne({
        userId: Data.user.id,
        platformName: 'non-existent-platform',
      });

      expect(found).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // find — retrieve all credentials for a user
  // ---------------------------------------------------------------------------

  describe('find (retrieve all credentials for a user)', () => {
    test('returns all credential records for the specified user', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'tok1',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'https://discord.example.com/1',
      });

      const records =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user.id,
        });

      expect(records.length).toBeGreaterThanOrEqual(2);
      records.forEach((r) => expect(r.userId).toBe(Data.user.id));
    });

    test('returns an empty array when the user has no credentials stored', async () => {
      const records =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user2.id,
        });

      expect(records).toEqual([]);
    });

    test('does not return credentials belonging to other users', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user1-ntfy',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user2.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user2-ntfy',
      });

      const user1Records =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user.id,
        });

      user1Records.forEach((r) => expect(r.userId).toBe(Data.user.id));
      const values = user1Records.map((r) => r.value);
      expect(values).not.toContain('user2-ntfy');
    });

    test('returns credentials filtered by platformName', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'gotify-val',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'discord-val',
      });

      const gotifyRecords =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user.id,
          platformName: 'gotify',
        });

      expect(gotifyRecords.length).toBeGreaterThanOrEqual(1);
      gotifyRecords.forEach((r) => expect(r.platformName).toBe('gotify'));
    });
  });

  // ---------------------------------------------------------------------------
  // update — modify stored credential values
  // ---------------------------------------------------------------------------

  describe('update (modify stored credential values)', () => {
    test('updates the value of an existing credential', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'old-token',
      });

      await notificationPlatformsCredentialsRepository.update({
        id,
        value: 'new-token',
      });

      const updated =
        await notificationPlatformsCredentialsRepository.findOne({ id });

      expect(updated.value).toBe('new-token');
    });

    test('updates the platformName field', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'https://discord.example.com/old',
      });

      await notificationPlatformsCredentialsRepository.update({
        id,
        platformName: 'ntfy',
      });

      const updated =
        await notificationPlatformsCredentialsRepository.findOne({ id });

      expect(updated.platformName).toBe('ntfy');
    });

    test('updates the name field', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'apiToken',
        value: 'po-tok',
      });

      await notificationPlatformsCredentialsRepository.update({
        id,
        name: 'token',
      });

      const updated =
        await notificationPlatformsCredentialsRepository.findOne({ id });

      expect(updated.name).toBe('token');
    });

    test('updating one record does not affect records belonging to other users', async () => {
      const idUser1 = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'user1-old',
      });
      const idUser2 = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user2.id,
        platformName: 'gotify',
        name: 'token',
        value: 'user2-value',
      });

      await notificationPlatformsCredentialsRepository.update({
        id: idUser1,
        value: 'user1-new',
      });

      const user2Record =
        await notificationPlatformsCredentialsRepository.findOne({
          id: idUser2,
        });

      expect(user2Record.value).toBe('user2-value');
    });
  });

  // ---------------------------------------------------------------------------
  // delete — remove credential records
  // ---------------------------------------------------------------------------

  describe('delete (remove credential records)', () => {
    test('removes a credential record by id', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'delete-me',
      });

      await notificationPlatformsCredentialsRepository.delete({ id });

      const found =
        await notificationPlatformsCredentialsRepository.findOne({ id });

      expect(found).toBeUndefined();
    });

    test('removes all credentials for a given userId', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'tok-A',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'wh-A',
      });

      await notificationPlatformsCredentialsRepository.delete({
        userId: Data.user.id,
      });

      const remaining =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user.id,
        });

      expect(remaining).toHaveLength(0);
    });

    test('delete is idempotent — deleting a non-existent record does not throw', async () => {
      await expect(
        notificationPlatformsCredentialsRepository.delete({ id: 999999 })
      ).resolves.not.toThrow();
    });

    test('deleting records for one user does not affect records of another user', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user1-topic',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user2.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user2-topic',
      });

      await notificationPlatformsCredentialsRepository.delete({
        userId: Data.user.id,
      });

      const user2Records =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user2.id,
        });

      expect(user2Records.length).toBeGreaterThanOrEqual(1);
      user2Records.forEach((r) => expect(r.userId).toBe(Data.user2.id));
    });

    test('removes all credentials for a given platformName and userId', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'token',
        value: 'po-tok',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'userKey',
        value: 'po-key',
      });

      await notificationPlatformsCredentialsRepository.delete({
        userId: Data.user.id,
        platformName: 'pushover',
      });

      const remaining =
        await notificationPlatformsCredentialsRepository.find({
          userId: Data.user.id,
          platformName: 'pushover',
        });

      expect(remaining).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // get — structured credential map for a user
  // ---------------------------------------------------------------------------

  describe('get (structured credential map for a user)', () => {
    test('returns an empty object when the user has no credentials', async () => {
      const result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(result).toEqual({});
    });

    test('returns a map keyed by platformName then by credential name', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'gotify-secret',
      });

      const result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(result).toHaveProperty('gotify');
      expect(result['gotify']).toEqual({ token: 'gotify-secret' });
    });

    test('groups multiple keys for the same platform under one entry', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'token',
        value: 'po-token',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushover',
        name: 'userKey',
        value: 'po-userkey',
      });

      const result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(result).toHaveProperty('pushover');
      expect((result as any)['pushover']).toEqual({
        token: 'po-token',
        userKey: 'po-userkey',
      });
    });

    test('returns credentials for multiple platforms in the same object', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'gotify-val',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'discord',
        name: 'webhookUrl',
        value: 'https://discord.example.com/hook',
      });

      const result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(result).toHaveProperty('gotify');
      expect(result).toHaveProperty('discord');
      expect((result as any)['gotify']).toEqual({ token: 'gotify-val' });
      expect((result as any)['discord']).toEqual({
        webhookUrl: 'https://discord.example.com/hook',
      });
    });

    test('does not include credentials belonging to other users', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user1-ntfy',
      });
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user2.id,
        platformName: 'ntfy',
        name: 'topic',
        value: 'user2-ntfy',
      });

      const user1Result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(user1Result['ntfy']).toEqual({ topic: 'user1-ntfy' });
      expect(user1Result['ntfy']['topic']).not.toBe('user2-ntfy');
    });

    test('reflects an updated value after update()', async () => {
      const id = await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'gotify',
        name: 'token',
        value: 'before-update',
      });

      await notificationPlatformsCredentialsRepository.update({
        id,
        value: 'after-update',
      });

      const result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(result['gotify']['token']).toBe('after-update');
    });

    test('no longer includes credentials for a platform after they have been deleted', async () => {
      await notificationPlatformsCredentialsRepository.create({
        userId: Data.user.id,
        platformName: 'pushbullet',
        name: 'accessToken',
        value: 'pb-token',
      });

      await notificationPlatformsCredentialsRepository.delete({
        userId: Data.user.id,
        platformName: 'pushbullet',
      });

      const result =
        await notificationPlatformsCredentialsRepository.get(Data.user.id);

      expect(result).not.toHaveProperty('pushbullet');
    });
  });
});
