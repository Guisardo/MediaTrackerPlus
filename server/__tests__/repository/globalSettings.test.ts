import { Database } from 'src/dbconfig';
import { Configuration } from 'src/entity/configuration';
import {
  configurationRepository,
  GlobalConfiguration,
} from 'src/repository/globalSettings';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';

/**
 * configurationRepository and GlobalConfiguration tests.
 *
 * The configuration table stores exactly one JSON document (`configurationJson`)
 * that is read and written as a whole.
 *
 * configurationRepository exposes:
 *   - create(value)  — replaces the entire configuration row
 *   - get()          — parses and returns the stored configuration
 *   - update(value)  — deep-merges the provided partial value into the stored
 *                       configuration AND keeps GlobalConfiguration in sync
 *
 * GlobalConfiguration is a static in-memory singleton that mirrors the
 * database state and provides:
 *   - get() / configuration getter  — returns the current in-memory config
 *   - update(value)                 — merges a partial update into memory
 *   - subscribe(key, handler)       — notifies listeners on value changes
 *
 * The `configuration` table is reset via delete() in afterEach so every test
 * begins from a clean state.  runMigrations() is called once in beforeAll.
 */

describe('configurationRepository', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  afterAll(clearDatabase);

  afterEach(async () => {
    await Database.knex('configuration').delete();
    // Reset the in-memory singleton to its default state between tests.
    GlobalConfiguration.configuration = { enableRegistration: true };
    GlobalConfiguration.listeners = [];
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Seed a configuration row with the given value. */
  async function seedConfiguration(value: Partial<Configuration>) {
    await configurationRepository.create(value);
  }

  // ---------------------------------------------------------------------------
  // get — retrieve stored configuration
  // ---------------------------------------------------------------------------

  describe('get (retrieve stored configuration)', () => {
    test('returns undefined when no configuration row exists', async () => {
      const result = await configurationRepository.get();

      expect(result).toBeUndefined();
    });

    test('returns the stored configuration when a row exists', async () => {
      await seedConfiguration({ enableRegistration: true });

      const result = await configurationRepository.get();

      expect(result).toBeDefined();
      expect(result!.enableRegistration).toBe(true);
    });

    test('returns false for enableRegistration when stored as false', async () => {
      await seedConfiguration({ enableRegistration: false });

      const result = await configurationRepository.get();

      expect(result!.enableRegistration).toBe(false);
    });

    test('returns optional fields such as tmdbLang when they are stored', async () => {
      await seedConfiguration({
        enableRegistration: true,
        tmdbLang: 'fr',
      });

      const result = await configurationRepository.get();

      expect(result!.tmdbLang).toBe('fr');
    });

    test('returns optional fields such as serverLang when they are stored', async () => {
      await seedConfiguration({
        enableRegistration: true,
        serverLang: 'de',
      });

      const result = await configurationRepository.get();

      expect(result!.serverLang).toBe('de');
    });

    test('returns optional fields such as audibleLang when they are stored', async () => {
      await seedConfiguration({
        enableRegistration: true,
        audibleLang: 'uk',
      });

      const result = await configurationRepository.get();

      expect(result!.audibleLang).toBe('uk');
    });
  });

  // ---------------------------------------------------------------------------
  // create — replace the configuration row
  // ---------------------------------------------------------------------------

  describe('create (replace the configuration row)', () => {
    test('creates a configuration row that can be retrieved with get()', async () => {
      await configurationRepository.create({
        enableRegistration: false,
        tmdbLang: 'es',
      });

      const result = await configurationRepository.get();

      expect(result).toBeDefined();
      expect(result!.enableRegistration).toBe(false);
      expect(result!.tmdbLang).toBe('es');
    });

    test('replaces the existing configuration row when called a second time', async () => {
      await configurationRepository.create({ enableRegistration: true });
      await configurationRepository.create({
        enableRegistration: false,
        serverLang: 'ko',
      });

      const rows: unknown[] = await Database.knex('configuration');
      // Only one row must exist after two create() calls.
      expect(rows).toHaveLength(1);

      const result = await configurationRepository.get();
      expect(result!.enableRegistration).toBe(false);
      expect(result!.serverLang).toBe('ko');
    });

    test('stores all provided fields in the JSON document', async () => {
      await configurationRepository.create({
        enableRegistration: true,
        tmdbLang: 'ja',
        serverLang: 'en',
        audibleLang: 'us',
        igdbClientId: 'my-client-id',
        igdbClientSecret: 'my-client-secret',
      });

      const result = await configurationRepository.get();

      expect(result!.tmdbLang).toBe('ja');
      expect(result!.serverLang).toBe('en');
      expect(result!.audibleLang).toBe('us');
      expect(result!.igdbClientId).toBe('my-client-id');
      expect(result!.igdbClientSecret).toBe('my-client-secret');
    });
  });

  // ---------------------------------------------------------------------------
  // update — deep-merge into stored configuration
  // ---------------------------------------------------------------------------

  describe('update (deep-merge into stored configuration)', () => {
    test('updates enableRegistration from true to false', async () => {
      await seedConfiguration({ enableRegistration: true });

      await configurationRepository.update({ enableRegistration: false });

      const result = await configurationRepository.get();

      expect(result!.enableRegistration).toBe(false);
    });

    test('updates a single field without overwriting other existing fields', async () => {
      await seedConfiguration({
        enableRegistration: true,
        tmdbLang: 'fr',
        serverLang: 'en',
      });

      await configurationRepository.update({ tmdbLang: 'de' });

      const result = await configurationRepository.get();

      expect(result!.tmdbLang).toBe('de');
      // Pre-existing fields must be preserved.
      expect(result!.enableRegistration).toBe(true);
      expect(result!.serverLang).toBe('en');
    });

    test('adds a new optional field to the stored configuration', async () => {
      await seedConfiguration({ enableRegistration: true });

      await configurationRepository.update({ audibleLang: 'ca' });

      const result = await configurationRepository.get();

      expect(result!.audibleLang).toBe('ca');
      expect(result!.enableRegistration).toBe(true);
    });

    test('update returns the merged configuration object', async () => {
      await seedConfiguration({ enableRegistration: true, tmdbLang: 'en' });

      const merged = await configurationRepository.update({ tmdbLang: 'pt' });

      expect(merged).toBeDefined();
      expect(merged.tmdbLang).toBe('pt');
      expect(merged.enableRegistration).toBe(true);
    });

    test('persists the updated value so a subsequent get() reflects the change', async () => {
      await seedConfiguration({ enableRegistration: true });
      await configurationRepository.update({ serverLang: 'da' });

      const result = await configurationRepository.get();

      expect(result!.serverLang).toBe('da');
    });

    test('update also synchronises GlobalConfiguration in memory', async () => {
      await seedConfiguration({ enableRegistration: true });

      await configurationRepository.update({ enableRegistration: false });

      const memConfig = GlobalConfiguration.get();
      expect(memConfig.enableRegistration).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // GlobalConfiguration — in-memory singleton
  // ---------------------------------------------------------------------------

  describe('GlobalConfiguration (in-memory singleton)', () => {
    test('get() returns the current in-memory configuration', () => {
      GlobalConfiguration.configuration = {
        enableRegistration: true,
        tmdbLang: 'en',
      };

      const config = GlobalConfiguration.get();

      expect(config.enableRegistration).toBe(true);
      expect(config.tmdbLang).toBe('en');
    });

    test('update() merges the provided partial value into the in-memory config', () => {
      GlobalConfiguration.configuration = { enableRegistration: true };
      GlobalConfiguration.update({ enableRegistration: false });

      expect(GlobalConfiguration.configuration.enableRegistration).toBe(false);
    });

    test('update() preserves fields that were not part of the partial update', () => {
      GlobalConfiguration.configuration = {
        enableRegistration: true,
        tmdbLang: 'es',
      };
      GlobalConfiguration.update({ serverLang: 'fr' });

      expect(GlobalConfiguration.configuration.enableRegistration).toBe(true);
      expect(GlobalConfiguration.configuration.tmdbLang).toBe('es');
      expect(GlobalConfiguration.configuration.serverLang).toBe('fr');
    });

    test('configuration setter replaces the entire in-memory object', () => {
      GlobalConfiguration.configuration = { enableRegistration: true };
      GlobalConfiguration.configuration = {
        enableRegistration: false,
        serverLang: 'ko',
      };

      expect(GlobalConfiguration.configuration.enableRegistration).toBe(false);
      expect(GlobalConfiguration.configuration.serverLang).toBe('ko');
    });

    test('subscribe() fires the handler when the watched key changes', async () => {
      GlobalConfiguration.configuration = { enableRegistration: true };

      const handler = jest.fn();
      GlobalConfiguration.subscribe('enableRegistration', handler);

      GlobalConfiguration.update({ enableRegistration: false });

      // Allow any async handler scheduling to settle.
      await new Promise((resolve) => setImmediate(resolve));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(false, true);
    });

    test('subscribe() does NOT fire the handler when the watched key does not change', async () => {
      GlobalConfiguration.configuration = { enableRegistration: true };

      const handler = jest.fn();
      GlobalConfiguration.subscribe('enableRegistration', handler);

      // Update a different key — enableRegistration stays the same.
      GlobalConfiguration.update({ serverLang: 'en' });

      await new Promise((resolve) => setImmediate(resolve));

      expect(handler).not.toHaveBeenCalled();
    });

    test('subscribe() does NOT fire the handler when the value is the same', async () => {
      GlobalConfiguration.configuration = { enableRegistration: true };

      const handler = jest.fn();
      GlobalConfiguration.subscribe('enableRegistration', handler);

      // Updating with the same value should not trigger the listener.
      GlobalConfiguration.update({ enableRegistration: true });

      await new Promise((resolve) => setImmediate(resolve));

      expect(handler).not.toHaveBeenCalled();
    });

    test('multiple subscribers for the same key are all notified', async () => {
      GlobalConfiguration.configuration = { enableRegistration: true };

      const handler1 = jest.fn();
      const handler2 = jest.fn();
      GlobalConfiguration.subscribe('enableRegistration', handler1);
      GlobalConfiguration.subscribe('enableRegistration', handler2);

      GlobalConfiguration.update({ enableRegistration: false });

      await new Promise((resolve) => setImmediate(resolve));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    test('subscribers for different keys do not cross-fire', async () => {
      GlobalConfiguration.configuration = {
        enableRegistration: true,
        serverLang: 'en',
      };

      const registrationHandler = jest.fn();
      const langHandler = jest.fn();
      GlobalConfiguration.subscribe('enableRegistration', registrationHandler);
      GlobalConfiguration.subscribe('serverLang', langHandler);

      // Only change enableRegistration.
      GlobalConfiguration.update({ enableRegistration: false });

      await new Promise((resolve) => setImmediate(resolve));

      expect(registrationHandler).toHaveBeenCalledTimes(1);
      expect(langHandler).not.toHaveBeenCalled();
    });
  });
});
