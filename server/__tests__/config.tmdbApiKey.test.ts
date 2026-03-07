/**
 * Isolated tests for Config.TMDB_API_KEY env var override.
 *
 * These tests are intentionally kept in a separate file from config.test.ts so
 * that the top-level jest.mock('src/config', ...) in that file does not suppress
 * the real module evaluation needed to test process.env.TMDB_API_KEY resolution.
 */

describe('Config.TMDB_API_KEY env var override', () => {
  const BUNDLED_KEY = '779734046efc1e6127485c54d3b29627';

  afterEach(() => {
    delete process.env.TMDB_API_KEY;
    jest.resetModules();
  });

  test('should return the bundled default key when TMDB_API_KEY is not set', () => {
    delete process.env.TMDB_API_KEY;

    let resolvedKey: string | undefined;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Config } = require('src/config') as typeof import('src/config');
      resolvedKey = Config.TMDB_API_KEY;
    });

    expect(resolvedKey).toBe(BUNDLED_KEY);
  });

  test('should use TMDB_API_KEY env var when set', () => {
    process.env.TMDB_API_KEY = 'my-custom-tmdb-key';

    let resolvedKey: string | undefined;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Config } = require('src/config') as typeof import('src/config');
      resolvedKey = Config.TMDB_API_KEY;
    });

    expect(resolvedKey).toBe('my-custom-tmdb-key');
  });

  test('should fall back to bundled key when TMDB_API_KEY is set to empty string', () => {
    process.env.TMDB_API_KEY = '';

    let resolvedKey: string | undefined;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Config } = require('src/config') as typeof import('src/config');
      resolvedKey = Config.TMDB_API_KEY;
    });

    // Empty string is falsy so the || fallback kicks in
    expect(resolvedKey).toBe(BUNDLED_KEY);
  });
});
