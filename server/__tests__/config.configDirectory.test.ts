describe('Config.CONFIG_DIRECTORY env var override', () => {
  const originalConfigDirectory = process.env.CONFIG_DIRECTORY;
  const originalDatabasePath = process.env.DATABASE_PATH;
  const originalHome = process.env.HOME;

  afterEach(() => {
    if (originalConfigDirectory === undefined) {
      delete process.env.CONFIG_DIRECTORY;
    } else {
      process.env.CONFIG_DIRECTORY = originalConfigDirectory;
    }

    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }

    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    jest.resetModules();
  });

  test('should prefer CONFIG_DIRECTORY over HOME-derived defaults', () => {
    process.env.CONFIG_DIRECTORY = '/tmp/mediatracker-config';
    delete process.env.DATABASE_PATH;
    process.env.HOME = '/tmp/ignored-home';

    let resolvedConfigDirectory: string | undefined;
    let resolvedAssetsPath: string | undefined;
    let resolvedLogsPath: string | undefined;
    let resolvedDatabasePath: string | undefined;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Config } = require('src/config') as typeof import('src/config');
      resolvedConfigDirectory = Config.configDirectory;
      resolvedAssetsPath = Config.ASSETS_PATH;
      resolvedLogsPath = Config.LOGS_PATH;
      resolvedDatabasePath = Config.DATABASE_PATH;
    });

    expect(resolvedConfigDirectory).toBe('/tmp/mediatracker-config');
    expect(resolvedAssetsPath).toBe('/tmp/mediatracker-config/img');
    expect(resolvedLogsPath).toBe('/tmp/mediatracker-config/logs');
    expect(resolvedDatabasePath).toBe('/tmp/mediatracker-config/data.db');
  });
});
