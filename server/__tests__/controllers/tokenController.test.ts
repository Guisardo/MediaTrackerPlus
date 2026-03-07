import { createHash } from 'crypto';
import { TokenController } from 'src/controllers/token';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * TokenController tests.
 *
 * Covers:
 *  - Listing all tokens for a user (GET /api/tokens)
 *  - Creating a new token (PUT /api/tokens)
 *  - Duplicate description rejection
 *  - Blank description rejection
 *  - Deleting a token by description (DELETE /api/tokens)
 *  - Verifying the returned raw token can be hashed to the stored hash
 *  - Token isolation between users
 */
describe('TokenController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('accessToken').delete();
  });

  // ---------------------------------------------------------------------------
  // get (list tokens)
  // ---------------------------------------------------------------------------

  describe('get', () => {
    test('returns HTTP 200 with an array', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns an empty array when the user has no tokens', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual([]);
    });

    test('returns the descriptions of existing tokens as strings', async () => {
      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'CI token',
        token: 'somehash',
      });

      const tokenController = new TokenController();

      const res = await request(tokenController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const descriptions = res.data as string[];
      expect(descriptions).toContain('CI token');
    });

    test('returns multiple token descriptions when user has several tokens', async () => {
      await Database.knex('accessToken').insert([
        { userId: Data.user.id, description: 'Token A', token: 'hash_a' },
        { userId: Data.user.id, description: 'Token B', token: 'hash_b' },
        { userId: Data.user.id, description: 'Token C', token: 'hash_c' },
      ]);

      const tokenController = new TokenController();

      const res = await request(tokenController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const descriptions = res.data as string[];
      expect(descriptions).toContain('Token A');
      expect(descriptions).toContain('Token B');
      expect(descriptions).toContain('Token C');
    });

    test('does not return tokens belonging to other users', async () => {
      // Token for user 2
      await Database.knex('accessToken').insert({
        userId: Data.user2.id,
        description: 'User2 private token',
        token: 'hash_user2',
      });

      // Token for user 1
      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'User1 token',
        token: 'hash_user1',
      });

      const tokenController = new TokenController();

      const res = await request(tokenController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      const descriptions = res.data as string[];
      expect(descriptions).toContain('User1 token');
      expect(descriptions).not.toContain('User2 private token');
    });
  });

  // ---------------------------------------------------------------------------
  // add (create token)
  // ---------------------------------------------------------------------------

  describe('add', () => {
    test('returns HTTP 200 with a token string on success', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'My first token' },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(typeof data.token).toBe('string');
      expect(data.token.length).toBeGreaterThan(0);
    });

    test('persists a new row in the accessToken table', async () => {
      const tokenController = new TokenController();

      await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'Persisted token' },
      });

      const dbRow = await Database.knex('accessToken')
        .where({ userId: Data.user.id, description: 'Persisted token' })
        .first();

      expect(dbRow).toBeDefined();
    });

    test('stores the SHA-256 hash of the raw token — not the raw token itself', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'Hash verification token' },
      });

      const rawToken = (res.data as any).token as string;
      const expectedHash = createHash('sha256')
        .update(rawToken, 'utf-8')
        .digest('hex');

      const dbRow = await Database.knex('accessToken')
        .where({
          userId: Data.user.id,
          description: 'Hash verification token',
        })
        .first();

      expect(dbRow).toBeDefined();
      expect(dbRow.token).toBe(expectedHash);
      expect(dbRow.token).not.toBe(rawToken);
    });

    test('returns HTTP 400 when the description is a blank string', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: '   ' },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 400 when a token with the same description already exists for the user', async () => {
      const tokenController = new TokenController();

      // Create the first token
      await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'Duplicate description' },
      });

      // Attempt to create a second token with the same description
      const res = await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'Duplicate description' },
      });

      expect(res.statusCode).toBe(400);
    });

    test('allows two different users to have tokens with the same description', async () => {
      const tokenController = new TokenController();

      const resUser1 = await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'Shared description' },
      });

      const resUser2 = await request(tokenController.add, {
        userId: Data.user2.id,
        requestQuery: { description: 'Shared description' },
      });

      expect(resUser1.statusCode).toBe(200);
      expect(resUser2.statusCode).toBe(200);
    });

    test('the raw token returned is different from what is stored in the database', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.add, {
        userId: Data.user.id,
        requestQuery: { description: 'Raw vs hash check' },
      });

      const rawToken = (res.data as any).token as string;

      const dbRow = await Database.knex('accessToken')
        .where({
          userId: Data.user.id,
          description: 'Raw vs hash check',
        })
        .first();

      // The stored token is the hash, not the raw value
      expect(dbRow.token).not.toBe(rawToken);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    test('returns HTTP 200 on successful deletion', async () => {
      const tokenController = new TokenController();

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'Token to delete',
        token: 'somehash',
      });

      const res = await request(tokenController.delete, {
        userId: Data.user.id,
        requestQuery: { description: 'Token to delete' },
      });

      expect(res.statusCode).toBe(200);
    });

    test('removes the token row from the database', async () => {
      const tokenController = new TokenController();

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'DB removal token',
        token: 'hash_to_remove',
      });

      await request(tokenController.delete, {
        userId: Data.user.id,
        requestQuery: { description: 'DB removal token' },
      });

      const dbRow = await Database.knex('accessToken')
        .where({ userId: Data.user.id, description: 'DB removal token' })
        .first();

      expect(dbRow).toBeUndefined();
    });

    test('returns HTTP 200 even when the token does not exist (idempotent)', async () => {
      const tokenController = new TokenController();

      const res = await request(tokenController.delete, {
        userId: Data.user.id,
        requestQuery: { description: 'Non-existent description' },
      });

      expect(res.statusCode).toBe(200);
    });

    test('does not delete tokens belonging to other users', async () => {
      const tokenController = new TokenController();

      await Database.knex('accessToken').insert({
        userId: Data.user2.id,
        description: 'Protected token',
        token: 'hash_protected',
      });

      // Data.user tries to delete Data.user2's token by description
      await request(tokenController.delete, {
        userId: Data.user.id,
        requestQuery: { description: 'Protected token' },
      });

      const dbRow = await Database.knex('accessToken')
        .where({ userId: Data.user2.id, description: 'Protected token' })
        .first();

      // Row should still exist — only tokens matching userId AND description are deleted
      expect(dbRow).toBeDefined();
    });

    test('token no longer appears in the get response after deletion', async () => {
      const tokenController = new TokenController();

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'Disappearing token',
        token: 'hash_disappear',
      });

      await request(tokenController.delete, {
        userId: Data.user.id,
        requestQuery: { description: 'Disappearing token' },
      });

      const getRes = await request(tokenController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const descriptions = getRes.data as string[];
      expect(descriptions).not.toContain('Disappearing token');
    });
  });
});
