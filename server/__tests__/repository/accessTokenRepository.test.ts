import { createHash } from 'crypto';
import { Database } from 'src/dbconfig';
import { AccessToken } from 'src/entity/accessToken';
import { accessTokenRepository } from 'src/repository/accessToken';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * Computes the SHA-256 hex digest of a plain-text token.
 * Mirrors the hashing logic used in AccessTokenMiddleware so we can insert
 * hashed tokens directly via Knex and then verify lookup behaviour.
 */
function sha256(raw: string): string {
  return createHash('sha256').update(raw, 'utf-8').digest('hex');
}

describe('accessTokenRepository', () => {
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
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    test('inserts a new row and returns its id', async () => {
      const id = await accessTokenRepository.create({
        userId: Data.user.id,
        description: 'CI pipeline token',
        token: sha256('raw-value-1'),
      });

      expect(typeof id).toBe('number');

      const row: AccessToken = await Database.knex('accessToken')
        .where({ id })
        .first();

      expect(row).toBeDefined();
      expect(row.userId).toBe(Data.user.id);
      expect(row.description).toBe('CI pipeline token');
    });

    test('stores the hashed token exactly as provided', async () => {
      const rawToken = 'my-secret-token';
      const hashedToken = sha256(rawToken);

      const id = await accessTokenRepository.create({
        userId: Data.user.id,
        description: 'Hash storage test',
        token: hashedToken,
      });

      const row: AccessToken = await Database.knex('accessToken')
        .where({ id })
        .first();

      expect(row.token).toBe(hashedToken);
      expect(row.token).not.toBe(rawToken);
    });

    test('allows two different users to hold tokens with the same description', async () => {
      await accessTokenRepository.create({
        userId: Data.user.id,
        description: 'shared-desc',
        token: sha256('token-user1'),
      });

      await accessTokenRepository.create({
        userId: Data.user2.id,
        description: 'shared-desc',
        token: sha256('token-user2'),
      });

      const rows: AccessToken[] = await Database.knex('accessToken').where({
        description: 'shared-desc',
      });

      expect(rows).toHaveLength(2);
    });

    test('allows a single user to own multiple tokens with different descriptions', async () => {
      await accessTokenRepository.create({
        userId: Data.user.id,
        description: 'token-a',
        token: sha256('raw-a'),
      });
      await accessTokenRepository.create({
        userId: Data.user.id,
        description: 'token-b',
        token: sha256('raw-b'),
      });

      const rows: AccessToken[] = await Database.knex('accessToken').where({
        userId: Data.user.id,
      });

      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — lookup by hashed token value
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    test('returns the matching AccessToken record when queried by token hash', async () => {
      const rawToken = 'findable-token-xyz';
      const hashedToken = sha256(rawToken);

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'findOne test',
        token: hashedToken,
      });

      const found = await accessTokenRepository.findOne({ token: hashedToken });

      expect(found).toBeDefined();
      expect(found.userId).toBe(Data.user.id);
      expect(found.description).toBe('findOne test');
      expect(found.token).toBe(hashedToken);
    });

    test('returns undefined when no token matches the hash', async () => {
      const found = await accessTokenRepository.findOne({
        token: sha256('non-existent-token'),
      });

      expect(found).toBeUndefined();
    });

    test('returns the correct record when multiple tokens exist', async () => {
      const hash1 = sha256('token-multi-1');
      const hash2 = sha256('token-multi-2');

      await Database.knex('accessToken').insert([
        { userId: Data.user.id, description: 'multi-1', token: hash1 },
        { userId: Data.user.id, description: 'multi-2', token: hash2 },
      ]);

      const found = await accessTokenRepository.findOne({ token: hash2 });

      expect(found).toBeDefined();
      expect(found.description).toBe('multi-2');
    });

    test('findOne by userId returns one of the user tokens', async () => {
      const hash = sha256('user-lookup-token');

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'user-lookup',
        token: hash,
      });

      const found = await accessTokenRepository.findOne({
        userId: Data.user.id,
      });

      expect(found).toBeDefined();
      expect(found.userId).toBe(Data.user.id);
    });
  });

  // ---------------------------------------------------------------------------
  // find — list tokens for a user
  // ---------------------------------------------------------------------------

  describe('find (list tokens for user)', () => {
    test('returns an empty array when the user has no tokens', async () => {
      const tokens = await accessTokenRepository.find({ userId: Data.user.id });

      expect(tokens).toEqual([]);
    });

    test('returns only the tokens that belong to the specified user', async () => {
      await Database.knex('accessToken').insert([
        { userId: Data.user.id, description: 'user1-token-A', token: sha256('u1-a') },
        { userId: Data.user.id, description: 'user1-token-B', token: sha256('u1-b') },
        { userId: Data.user2.id, description: 'user2-token', token: sha256('u2') },
      ]);

      const user1Tokens = await accessTokenRepository.find({
        userId: Data.user.id,
      });

      expect(user1Tokens).toHaveLength(2);
      user1Tokens.forEach((t) => expect(t.userId).toBe(Data.user.id));

      const descriptions = user1Tokens.map((t) => t.description);
      expect(descriptions).toContain('user1-token-A');
      expect(descriptions).toContain('user1-token-B');
      expect(descriptions).not.toContain('user2-token');
    });

    test('returns all tokens when no filter is provided', async () => {
      await Database.knex('accessToken').insert([
        { userId: Data.user.id, description: 'all-A', token: sha256('all-a') },
        { userId: Data.user2.id, description: 'all-B', token: sha256('all-b') },
      ]);

      const allTokens = await accessTokenRepository.find();

      expect(allTokens.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    test('removes the specified token from the database', async () => {
      const hash = sha256('to-delete');

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'delete-me',
        token: hash,
      });

      await accessTokenRepository.delete({ token: hash });

      const row = await Database.knex('accessToken')
        .where({ token: hash })
        .first();

      expect(row).toBeUndefined();
    });

    test('does not delete tokens belonging to other users when deleting by userId', async () => {
      const hashU1 = sha256('user1-keep');
      const hashU2 = sha256('user2-keep');

      await Database.knex('accessToken').insert([
        { userId: Data.user.id, description: 'u1-keep', token: hashU1 },
        { userId: Data.user2.id, description: 'u2-keep', token: hashU2 },
      ]);

      await accessTokenRepository.delete({ userId: Data.user.id });

      const user2Row = await Database.knex('accessToken')
        .where({ userId: Data.user2.id })
        .first();

      expect(user2Row).toBeDefined();
      expect(user2Row.token).toBe(hashU2);
    });

    test('is idempotent — deleting a non-existent token does not throw', async () => {
      await expect(
        accessTokenRepository.delete({ token: sha256('ghost-token') })
      ).resolves.not.toThrow();
    });

    test('after deletion the token is no longer returned by findOne', async () => {
      const hash = sha256('ephemeral');

      await Database.knex('accessToken').insert({
        userId: Data.user.id,
        description: 'ephemeral-token',
        token: hash,
      });

      await accessTokenRepository.delete({ token: hash });

      const found = await accessTokenRepository.findOne({ token: hash });

      expect(found).toBeUndefined();
    });
  });
});
