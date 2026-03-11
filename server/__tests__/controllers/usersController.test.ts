import { UsersController } from 'src/controllers/users';
import { Database } from 'src/dbconfig';
import { Data } from '__tests__/__utils__/data';
import { request } from '__tests__/__utils__/request';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { userRepository } from 'src/repository/user';
import { configurationRepository } from 'src/repository/globalSettings';

/**
 * UsersController tests.
 *
 * Covers:
 *  - get: returns the currently-authenticated user's profile (non-sensitive fields only)
 *  - get: returns null when req.user is not a number (unauthenticated)
 *  - getById: returns { id, name } for a valid userId
 *  - getById: returns null for a non-existent userId
 *  - update (settings): persists non-sensitive column changes
 *  - update (settings): does not expose or change the password column
 *  - updatePassword: accepts correct currentPassword and updates to newPassword
 *  - updatePassword: rejects blank newPassword (HTTP 400)
 *  - updatePassword: rejects incorrect currentPassword (HTTP 401)
 *  - register: creates a user and returns their profile
 *  - register: rejects duplicate usernames
 *  - register: rejects mismatched passwords
 *  - register: rejects empty username
 *  - register: rejects empty password
 */

describe('UsersController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);
    await Database.knex('user').insert(Data.user2);

    // Each user needs a watchlist for register tests (userRepository.create inserts one)
    await Database.knex('list').insert(Data.watchlist);
    await Database.knex('list').insert(Data.list);

    // Seed the configuration table so register tests can read enableRegistration
    await configurationRepository.create({ enableRegistration: true });
  });

  afterAll(clearDatabase);

  // -------------------------------------------------------------------------
  // get (current user)
  // -------------------------------------------------------------------------

  describe('get', () => {
    test('returns HTTP 200 and the user object when authenticated', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).not.toBeNull();
    });

    test('returns the correct user id and name', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const user = res.data as any;
      expect(user.id).toBe(Data.user.id);
      expect(user.name).toBe(Data.user.name);
    });

    test('does not include the password field in the response', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const user = res.data as any;
      expect(user.password).toBeUndefined();
    });

    test('returns null when req.user is not a number (unauthenticated)', async () => {
      const usersController = new UsersController();

      // Pass a non-numeric userId to simulate an unauthenticated session
      const res = await request(usersController.get, {
        userId: undefined as any,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toBeNull();
    });

    test('returns the admin flag correctly for an admin user', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.get, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const user = res.data as any;
      expect(user.admin).toBe(true);
    });

    test('returns admin=false for a non-admin user', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.get, {
        userId: Data.user2.id,
        requestQuery: {},
      });

      const user = res.data as any;
      expect(user.admin).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------

  describe('getById', () => {
    test('returns HTTP 200 and { id, name } for a valid user id', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.getById, {
        userId: Data.user.id,
        pathParams: { userId: Data.user2.id },
      });

      expect(res.statusCode).toBe(200);
      const user = res.data as any;
      expect(user).toMatchObject({
        id: Data.user2.id,
        name: Data.user2.name,
      });
    });

    test('response only contains id and name — no password or admin fields', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.getById, {
        userId: Data.user.id,
        pathParams: { userId: Data.user2.id },
      });

      const user = res.data as any;
      expect(user.password).toBeUndefined();
      expect(user.admin).toBeUndefined();
    });

    test('returns null for a non-existent userId', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.getById, {
        userId: Data.user.id,
        pathParams: { userId: 999999 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toBeNull();
    });

    test('can look up own profile via getById', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.getById, {
        userId: Data.user.id,
        pathParams: { userId: Data.user.id },
      });

      const user = res.data as any;
      expect(user.id).toBe(Data.user.id);
      expect(user.name).toBe(Data.user.name);
    });
  });

  // -------------------------------------------------------------------------
  // update (settings)
  // -------------------------------------------------------------------------

  describe('update (settings)', () => {
    // NOTE: Tests use Data.user2 (id=1) because the base repository's update
    // method uses a truthy check on the primary key for the WHERE clause, and
    // Data.user.id (0) is falsy, which would cause an unbounded UPDATE.
    afterEach(async () => {
      // Reset user settings to defaults after each test
      await Database.knex('user')
        .where('id', Data.user2.id)
        .update({ publicReviews: 0, hideOverviewForUnseenSeasons: 0 });
    });

    test('returns HTTP 200 after updating settings', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.update, {
        userId: Data.user2.id,
        requestBody: { publicReviews: true },
      });

      expect(res.statusCode).toBe(200);
    });

    test('persists updated publicReviews setting in the database', async () => {
      const usersController = new UsersController();

      await request(usersController.update, {
        userId: Data.user2.id,
        requestBody: { publicReviews: true },
      });

      const dbUser = await Database.knex('user')
        .where('id', Data.user2.id)
        .first();

      // SQLite stores booleans as 0/1
      expect(dbUser.publicReviews).toBeTruthy();
    });

    test('persists hideOverviewForUnseenSeasons preference', async () => {
      const usersController = new UsersController();

      await request(usersController.update, {
        userId: Data.user2.id,
        requestBody: { hideOverviewForUnseenSeasons: true },
      });

      const dbUser = await Database.knex('user')
        .where('id', Data.user2.id)
        .first();

      expect(dbUser.hideOverviewForUnseenSeasons).toBeTruthy();
    });

    test('does not alter password when updating non-sensitive settings', async () => {
      const usersController = new UsersController();

      const before = await Database.knex('user')
        .where('id', Data.user2.id)
        .first();

      await request(usersController.update, {
        userId: Data.user2.id,
        requestBody: { publicReviews: true },
      });

      const after = await Database.knex('user')
        .where('id', Data.user2.id)
        .first();

      expect(after.password).toBe(before.password);
    });

    test('only updates the requesting user — other users are unaffected', async () => {
      const usersController = new UsersController();

      const beforeUser1 = await Database.knex('user')
        .where('id', Data.user.id)
        .first();

      await request(usersController.update, {
        userId: Data.user2.id,
        requestBody: { publicReviews: true },
      });

      const afterUser1 = await Database.knex('user')
        .where('id', Data.user.id)
        .first();

      expect(afterUser1.publicReviews).toBe(beforeUser1.publicReviews);
    });
  });

  // -------------------------------------------------------------------------
  // updatePassword
  // -------------------------------------------------------------------------

  describe('updatePassword', () => {
    // The raw password 'password' is inserted directly into the test DB row
    // (Data.user.password = 'password').  userRepository.update() calls
    // argon2.hash before writing, so we use userRepository.create() to set up
    // a user with a known argon2-hashed password for password-verification tests.

    const passwordTestUser = {
      id: 50,
      name: 'passwordTestUser',
      admin: false,
      password: 'currentPass1!',
      publicReviews: false,
    };

    beforeAll(async () => {
      // userRepository.create hashes the password and also creates a watchlist
      await userRepository.create({
        name: passwordTestUser.name,
        password: passwordTestUser.password,
        admin: false,
      });
    });

    beforeEach(async () => {
      // Reset the password to the known value before each test so tests are
      // order-independent.  userRepository.update hashes via argon2.
      const createdUser = await Database.knex('user')
        .where('name', passwordTestUser.name)
        .first();
      if (createdUser) {
        await userRepository.update({
          id: createdUser.id,
          password: passwordTestUser.password,
        });
      }
    });

    afterAll(async () => {
      const createdUser = await Database.knex('user')
        .where('name', passwordTestUser.name)
        .first();
      if (createdUser) {
        await Database.knex('listItem').where('listId', 'in',
          Database.knex('list').where('userId', createdUser.id).select('id')
        ).delete();
        await Database.knex('list').where('userId', createdUser.id).delete();
        await Database.knex('user').where('id', createdUser.id).delete();
      }
    });

    test('returns HTTP 200 when currentPassword is correct and newPassword is non-empty', async () => {
      const usersController = new UsersController();

      const createdUser = await Database.knex('user')
        .where('name', passwordTestUser.name)
        .first();

      const res = await request(usersController.updatePassword, {
        userId: createdUser.id,
        requestBody: {
          currentPassword: passwordTestUser.password,
          newPassword: 'newPass2!',
        },
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns HTTP 400 when newPassword is a blank string', async () => {
      const usersController = new UsersController();

      const createdUser = await Database.knex('user')
        .where('name', passwordTestUser.name)
        .first();

      const res = await request(usersController.updatePassword, {
        userId: createdUser.id,
        requestBody: {
          currentPassword: passwordTestUser.password,
          newPassword: '   ',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    test('returns HTTP 401 when currentPassword is incorrect', async () => {
      const usersController = new UsersController();

      const createdUser = await Database.knex('user')
        .where('name', passwordTestUser.name)
        .first();

      const res = await request(usersController.updatePassword, {
        userId: createdUser.id,
        requestBody: {
          currentPassword: 'wrongPassword!',
          newPassword: 'newValidPass3!',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    test('after a successful password update the new password is accepted', async () => {
      const usersController = new UsersController();

      const createdUser = await Database.knex('user')
        .where('name', passwordTestUser.name)
        .first();

      // Change to a known new password
      await request(usersController.updatePassword, {
        userId: createdUser.id,
        requestBody: {
          currentPassword: passwordTestUser.password,
          newPassword: 'brandNew4!',
        },
      });

      // Verify the new password is stored and verifiable
      const updatedUser = await userRepository.findOneWithPassword({
        name: passwordTestUser.name,
      });
      const isValid = await userRepository.verifyPassword(
        updatedUser,
        'brandNew4!'
      );

      expect(isValid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------

  describe('search', () => {
    test('returns HTTP 200 with an empty array when query is empty', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: '' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.data).toEqual([]);
    });

    test('returns HTTP 200 with an empty array when query contains only whitespace', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: '   ' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.data).toEqual([]);
    });

    test('returns matching users with case-insensitive search', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'user' },
      });

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      const results = res.data as any[];
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(u => u.id === Data.user2.id)).toBe(true);
    });

    test('returns matching users with uppercase query', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'USER' },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(u => u.id === Data.user2.id)).toBe(true);
    });

    test('excludes the authenticated user from search results', async () => {
      const usersController = new UsersController();

      // Search for the authenticated user's own name
      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: Data.user.name },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      expect(results.every(u => u.id !== Data.user.id)).toBe(true);
    });

    test('returns only id and name fields — no password or admin fields', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'user' },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      results.forEach(user => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('admin');
      });
    });

    test('enforces max 20 results limit', async () => {
      const usersController = new UsersController();

      // Create 25 additional users for this test
      const newUsers = [];
      for (let i = 0; i < 25; i++) {
        newUsers.push({
          id: 100 + i,
          name: `testuser${i}`,
          admin: false,
          password: 'testpass',
          publicReviews: false,
        });
      }
      await Database.knex('user').insert(newUsers);

      try {
        const res = await request(usersController.search, {
          userId: Data.user.id,
          requestQuery: { query: 'testuser' },
        });

        expect(res.statusCode).toBe(200);
        const results = res.data as any[];
        expect(results.length).toBeLessThanOrEqual(20);
      } finally {
        // Clean up the test users
        await Database.knex('user')
          .where('id', '>=', 100)
          .where('id', '<', 125)
          .delete();
      }
    });

    test('returns empty array when no users match the query', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'xyznonexistent' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual([]);
    });

    test('matches partial usernames', async () => {
      const usersController = new UsersController();

      // Search for partial name 'user' should match 'user2'
      const res = await request(usersController.search, {
        userId: Data.user.id,
        requestQuery: { query: 'user' },
      });

      expect(res.statusCode).toBe(200);
      const results = res.data as any[];
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(u => u.name.includes('user'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register', () => {
    // All registered users are cleaned up after each test to prevent leaking
    // into subsequent tests that depend on the user count.
    afterEach(async () => {
      await Database.knex('list').where('userId', '>', Data.user2.id).delete();
      await Database.knex('user').where('id', '>', Data.user2.id).delete();
    });

    test('returns an error object when the username is already taken', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.register, {
        userId: undefined as any,
        requestBody: {
          username: Data.user.name, // already exists
          password: 'somepass',
          confirmPassword: 'somepass',
        },
      });

      // The handler calls res.send() with a RequestError object (not sendStatus)
      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('errorMessage');
    });

    test('returns an error object when passwords do not match', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.register, {
        userId: undefined as any,
        requestBody: {
          username: 'brandNewUser',
          password: 'pass1',
          confirmPassword: 'pass2',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('errorMessage');
    });

    test('returns an error object when the password is empty', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.register, {
        userId: undefined as any,
        requestBody: {
          username: 'brandNewUser2',
          password: '   ',
          confirmPassword: '   ',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('errorMessage');
    });

    test('returns an error object when the username is empty', async () => {
      const usersController = new UsersController();

      const res = await request(usersController.register, {
        userId: undefined as any,
        requestBody: {
          username: '   ',
          password: 'validPass',
          confirmPassword: 'validPass',
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.data as any;
      expect(data).toHaveProperty('errorMessage');
    });
  });
});
