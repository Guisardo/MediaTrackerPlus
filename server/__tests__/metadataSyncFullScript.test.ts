import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';

const sourceScriptPath = resolve(__dirname, '../../scripts/metadata-sync-full.sh');

const createTempRepo = () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'mediatracker-metadata-sync-'));
  mkdirSync(join(rootDir, 'scripts'), { recursive: true });
  mkdirSync(join(rootDir, 'server'), { recursive: true });
  copyFileSync(sourceScriptPath, join(rootDir, 'scripts/metadata-sync-full.sh'));
  return rootDir;
};

const runMetadataSyncScript = (rootDir: string, env?: NodeJS.ProcessEnv) =>
  spawnSync('/bin/sh', [join(rootDir, 'scripts/metadata-sync-full.sh')], {
    cwd: rootDir,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  });

describe('metadata-sync-full.sh', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test('fails fast when repo root .env is missing', () => {
    const rootDir = createTempRepo();
    tempDirs.push(rootDir);

    const result = runMetadataSyncScript(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env not found');
  });

  test('fails fast when server dependencies are not installed', () => {
    const rootDir = createTempRepo();
    tempDirs.push(rootDir);
    writeFileSync(join(rootDir, '.env'), 'DATABASE_PATH=./server/data.db\n');

    const result = runMetadataSyncScript(rootDir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Run npm install');
  });

  test('loads root .env before invoking the server runner', () => {
    const rootDir = createTempRepo();
    tempDirs.push(rootDir);

    const binDir = join(rootDir, 'bin');
    const npmStubPath = join(binDir, 'npm');
    const argsFile = join(rootDir, 'captured-args.txt');
    const envFile = join(rootDir, 'captured-env.txt');
    const pwdFile = join(rootDir, 'captured-pwd.txt');
    const babelNodePath = join(rootDir, 'server/node_modules/.bin/babel-node');

    mkdirSync(binDir, { recursive: true });
    mkdirSync(join(rootDir, 'server/node_modules/.bin'), { recursive: true });
    writeFileSync(
      join(rootDir, '.env'),
      [
        'DATABASE_PATH=./server/data.db',
        'ASSETS_PATH=./server/assets',
        'LOGS_PATH=./server/logs',
        'TMDB_LANG=es',
        'IGDB_CLIENT_ID=test-client-id',
        'IGDB_CLIENT_SECRET=test-client-secret',
      ].join('\n') + '\n'
    );
    writeFileSync(babelNodePath, '#!/bin/sh\nexit 0\n');
    chmodSync(babelNodePath, 0o755);
    writeFileSync(
      npmStubPath,
      [
        '#!/bin/sh',
        'printf \'%s\\n\' "$*" > "$TEST_ARGS_FILE"',
        'pwd > "$TEST_PWD_FILE"',
        'env | sort > "$TEST_ENV_FILE"',
      ].join('\n') + '\n'
    );
    chmodSync(npmStubPath, 0o755);

    const result = runMetadataSyncScript(rootDir, {
      PATH: `${binDir}:${process.env.PATH || ''}`,
      TEST_ARGS_FILE: argsFile,
      TEST_ENV_FILE: envFile,
      TEST_PWD_FILE: pwdFile,
    });

    expect(result.status).toBe(0);
    expect(readFileSync(argsFile, 'utf8')).toContain(
      'run metadata:sync:full --prefix server'
    );
    expect(readFileSync(envFile, 'utf8')).toContain(
      `DATABASE_PATH=${join(rootDir, 'server/data.db')}`
    );
    expect(readFileSync(envFile, 'utf8')).toContain(
      `ASSETS_PATH=${join(rootDir, 'server/assets')}`
    );
    expect(readFileSync(envFile, 'utf8')).toContain(
      `LOGS_PATH=${join(rootDir, 'server/logs')}`
    );
    expect(readFileSync(envFile, 'utf8')).toContain('TMDB_LANG=es');
    expect(readFileSync(envFile, 'utf8')).toContain(
      'IGDB_CLIENT_ID=test-client-id'
    );
    expect(readFileSync(envFile, 'utf8')).toContain(
      'IGDB_CLIENT_SECRET=test-client-secret'
    );
    expect(readFileSync(pwdFile, 'utf8').trim()).toBe(rootDir);
  });

  test('prefers the repo-pinned Node/npm when .nvmrc matches an installed nvm version', () => {
    const rootDir = createTempRepo();
    tempDirs.push(rootDir);

    const fallbackBinDir = join(rootDir, 'fallback-bin');
    const fakeHomeDir = join(rootDir, 'fake-home');
    const nvmBinDir = join(
      fakeHomeDir,
      '.nvm/versions/node/v22.12.0/bin'
    );
    const fallbackNpmPath = join(fallbackBinDir, 'npm');
    const nvmNpmPath = join(nvmBinDir, 'npm');
    const argsFile = join(rootDir, 'captured-args.txt');

    mkdirSync(fallbackBinDir, { recursive: true });
    mkdirSync(nvmBinDir, { recursive: true });
    mkdirSync(join(rootDir, 'server/node_modules/.bin'), { recursive: true });

    writeFileSync(join(rootDir, '.env'), 'DATABASE_PATH=./server/data.db\n');
    writeFileSync(join(rootDir, '.nvmrc'), '22.12.0\n');
    writeFileSync(
      join(rootDir, 'server/node_modules/.bin/babel-node'),
      '#!/bin/sh\nexit 0\n'
    );
    chmodSync(join(rootDir, 'server/node_modules/.bin/babel-node'), 0o755);
    writeFileSync(
      fallbackNpmPath,
      '#!/bin/sh\nprintf \'fallback\\n\' > "$TEST_ARGS_FILE"\n'
    );
    chmodSync(fallbackNpmPath, 0o755);
    writeFileSync(
      nvmNpmPath,
      '#!/bin/sh\nprintf \'nvm\\n%s\\n\' "$*" > "$TEST_ARGS_FILE"\n'
    );
    chmodSync(nvmNpmPath, 0o755);
    writeFileSync(join(nvmBinDir, 'node'), '#!/bin/sh\nexit 0\n');
    chmodSync(join(nvmBinDir, 'node'), 0o755);

    const result = runMetadataSyncScript(rootDir, {
      HOME: fakeHomeDir,
      PATH: `${fallbackBinDir}:${process.env.PATH || ''}`,
      TEST_ARGS_FILE: argsFile,
    });

    expect(result.status).toBe(0);
    expect(readFileSync(argsFile, 'utf8')).toContain('nvm');
    expect(readFileSync(argsFile, 'utf8')).toContain(
      'run metadata:sync:full --prefix server'
    );
  });
});
